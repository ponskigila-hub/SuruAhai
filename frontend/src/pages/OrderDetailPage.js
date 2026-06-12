import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Calendar, Clock, Phone, Star,
  CheckCircle, AlertCircle, XCircle, MessageCircle, Wallet
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getOrder,
  updateOrderStatus,
  createReview,
  getMitra,
  getOrderMessages,
  sendOrderMessage,
  payOrder,
  getWallet
} from '../services/api';
import WalletTopUpModal, { MIN_TOPUP_IDR } from '../components/WalletTopUpModal';
import { toast } from 'sonner';

const statusConfig = {
  NEGOTIATING: { color: 'primary', label: 'Negosiasi Harga', step: 0 },
  AWAITING_PAYMENT: { color: 'warning', label: 'Menunggu Pembayaran', step: 0 },
  PENDING: { color: 'warning', label: 'Menunggu Konfirmasi', step: 1 },
  CONFIRMED: { color: 'info', label: 'Dikonfirmasi', step: 2 },
  IN_PROGRESS: { color: 'info', label: 'Sedang Dikerjakan', step: 3 },
  AWAITING_USER_CONFIRMATION: { color: 'warning', label: 'Menunggu Konfirmasi Anda', step: 4 },
  COMPLETED: { color: 'success', label: 'Selesai', step: 5 },
  CANCELLED: { color: 'error', label: 'Dibatalkan', step: 0 }
};

const timelineLabels = ['Menunggu', 'Dikonfirmasi', 'Dikerjakan', 'Konfirmasi', 'Selesai'];

const formatCurrency = (amount) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount || 0);

const getMessageKey = (message) =>
  message?.id ||
  [
    message?.order_id,
    message?.sender_id,
    message?.message_type,
    message?.created_at,
    message?.offer_amount,
    message?.message
  ].join('|');

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  loading = false,
  onCancel,
  onConfirm,
  children
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Tutup"
        disabled={loading}
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <h2 className="font-heading text-lg font-semibold text-secondary">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        {children}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-xl px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />}
            <span>{loading ? 'Memproses...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [mitra, setMitra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const chatContainerRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const pollingMessagesRef = useRef(false);

  const isChatNearBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }, []);

  const rememberChatScrollPosition = useCallback(() => {
    shouldStickToBottomRef.current = isChatNearBottom();
  }, [isChatNearBottom]);

  const mergeMessages = useCallback((incomingMessages, options = {}) => {
    const nextMessages = (Array.isArray(incomingMessages) ? incomingMessages : []).filter(Boolean);
    if (nextMessages.length === 0) return;
    if (options.stickToBottom) {
      shouldStickToBottomRef.current = true;
    } else {
      rememberChatScrollPosition();
    }

    setMessages((currentMessages) => {
      const byKey = new Map();
      [...currentMessages, ...nextMessages].forEach((message) => {
        byKey.set(getMessageKey(message), message);
      });
      return Array.from(byKey.values()).sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
      );
    });
  }, [rememberChatScrollPosition]);

  const loadMessages = useCallback(async () => {
    if (pollingMessagesRef.current) return;
    pollingMessagesRef.current = true;
    try {
      const response = await getOrderMessages(orderId);
      mergeMessages(response.data);
    } catch {
      //
    } finally {
      pollingMessagesRef.current = false;
    }
  }, [orderId, mergeMessages]);

  const loadOrder = useCallback(async () => {
    try {
      const [response, messagesRes] = await Promise.all([
        getOrder(orderId),
        getOrderMessages(orderId).catch(() => ({ data: [] }))
      ]);
      setOrder(response.data);
      mergeMessages(messagesRes.data, { stickToBottom: true });
      
      if (response.data.mitra_id) {
        const mitraRes = await getMitra(response.data.mitra_id);
        setMitra(mitraRes.data);
      }
    } catch (error) {
      toast.error('Gagal memuat detail pesanan');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [orderId, navigate, mergeMessages]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    setMessages([]);
    shouldStickToBottomRef.current = true;
  }, [orderId]);

  useEffect(() => {
    const intervalId = window.setInterval(loadMessages, 2500);
    return () => window.clearInterval(intervalId);
  }, [loadMessages]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleStatusUpdate = async (nextStatus) => {
    try {
      await updateOrderStatus(orderId, nextStatus);
      const label = statusConfig[nextStatus]?.label ?? nextStatus;
      toast.success(`Status pesanan diperbarui ke ${label}`);
      loadOrder();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal memperbarui status');
    }
  };

  const handleSendTextMessage = async () => {
    const text = chatText.trim();
    if (!text) {
      toast.error('Pesan tidak boleh kosong');
      return;
    }

    setChatSubmitting(true);
    try {
      const response = await sendOrderMessage(orderId, {
        message: text,
        message_type: 'TEXT'
      });
      setChatText('');
      mergeMessages([response.data], { stickToBottom: true });
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal mengirim pesan');
    } finally {
      setChatSubmitting(false);
    }
  };

  const handleSendOffer = async () => {
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Masukkan nominal penawaran yang valid');
      return;
    }

    setChatSubmitting(true);
    try {
      const response = await sendOrderMessage(orderId, {
        message: chatText.trim(),
        message_type: 'OFFER',
        offer_amount: amount
      });
      setChatText('');
      setOfferAmount('');
      mergeMessages([response.data], { stickToBottom: true });
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal mengirim penawaran');
    } finally {
      setChatSubmitting(false);
    }
  };

  const handleSetFinalPrice = async () => {
    const amount = Number(finalPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Masukkan harga final yang valid');
      return;
    }

    setChatSubmitting(true);
    try {
      const response = await sendOrderMessage(orderId, {
        message: chatText.trim(),
        message_type: 'FINAL_PRICE',
        offer_amount: amount
      });
      setChatText('');
      setFinalPrice('');
      mergeMessages([response.data], { stickToBottom: true });
      toast.success('Harga final dikirim');
      await loadOrder();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal menentukan harga final');
    } finally {
      setChatSubmitting(false);
    }
  };

  const handlePayOrder = async () => {
    setPaying(true);
    try {
      const amount = Number(order?.final_price || order?.total_amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Total pembayaran tidak valid');
        return;
      }

      const walletRes = await getWallet();
      const balance = Number(walletRes.data?.balance || 0);
      setWalletBalance(balance);
      if (balance < amount) {
        setPayConfirmOpen(false);
        setInsufficientOpen(true);
        return;
      }

      await payOrder(orderId);
      toast.success('Pembayaran berhasil');
      setPayConfirmOpen(false);
      await loadOrder();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (
        typeof detail === 'string' &&
        (detail.toLowerCase().includes('tidak mencukupi') || detail.toLowerCase().includes('top up'))
      ) {
        try {
          const walletRes = await getWallet();
          setWalletBalance(Number(walletRes.data?.balance || 0));
        } catch {
          setWalletBalance(0);
        }
        setPayConfirmOpen(false);
        setInsufficientOpen(true);
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Gagal melakukan pembayaran');
      }
    } finally {
      setPaying(false);
    }
  };

  const handleTopUpSuccess = async () => {
    try {
      const walletRes = await getWallet();
      setWalletBalance(Number(walletRes.data?.balance || 0));
    } catch {
      //
    }
    await loadOrder();
    setPayConfirmOpen(true);
  };

  const handleUserConfirmCompleted = () => {
    setCompleteConfirmOpen(false);
    handleStatusUpdate('COMPLETED');
  };

  const handleReviewSubmit = async () => {
    if (!review.rating) {
      toast.error('Mohon berikan rating');
      return;
    }

    setSubmitting(true);
    try {
      await createReview({
        order_id: orderId,
        rating: review.rating,
        comment: review.comment
      });
      toast.success('Ulasan berhasil dikirim!');
      setShowReview(false);
      loadOrder();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengirim ulasan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-slate-500">Pesanan tidak ditemukan</p>
      </div>
    );
  }

  const status = statusConfig[order.status] || {
    color: 'info',
    label: order.status,
    step: 0
  };
  const canChat = !['COMPLETED', 'CANCELLED'].includes(order.status);
  const canUserOffer = user?.role === 'USER' && order.status === 'NEGOTIATING';
  const canMitraSetFinal =
    user?.role === 'MITRA' && ['NEGOTIATING', 'AWAITING_PAYMENT'].includes(order.status);
  const agreedAmount = Number(order.final_price || order.total_amount || 0);
  const walletShortage = walletBalance === null ? 0 : Math.max(0, agreedAmount - walletBalance);
  const suggestedTopupAmount = Math.max(walletShortage, MIN_TOPUP_IDR);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-heading font-semibold text-secondary">Detail Pesanan</h1>
              <p className="text-sm text-slate-500">#{order.id?.slice(-8)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Status Card */}
        <div className={`card p-6 border-l-4 ${
          status.color === 'success' ? 'border-l-green-500 bg-green-50' :
          status.color === 'warning' ? 'border-l-yellow-500 bg-yellow-50' :
          status.color === 'error' ? 'border-l-red-500 bg-red-50' :
          status.color === 'primary' ? 'border-l-primary bg-primary/5' :
          'border-l-blue-500 bg-blue-50'
        }`}>
          <div className="flex items-center gap-3">
            {status.color === 'success' && <CheckCircle className="w-6 h-6 text-green-500" />}
            {status.color === 'warning' && <AlertCircle className="w-6 h-6 text-yellow-500" />}
            {status.color === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
            {status.color === 'primary' && <MessageCircle className="w-6 h-6 text-primary" />}
            {status.color === 'info' && <AlertCircle className="w-6 h-6 text-blue-500" />}
            <div>
              <p className={`font-heading font-semibold ${
                status.color === 'success' ? 'text-green-700' :
                status.color === 'warning' ? 'text-yellow-700' :
                status.color === 'error' ? 'text-red-700' :
                status.color === 'primary' ? 'text-primary' :
                'text-blue-700'
              }`}>
                {status.label}
              </p>
              <p className={`text-sm ${
                status.color === 'success' ? 'text-green-600' :
                status.color === 'warning' ? 'text-yellow-600' :
                status.color === 'error' ? 'text-red-600' :
                status.color === 'primary' ? 'text-primary/80' :
                'text-blue-600'
              }`}>
                {order.status === 'NEGOTIATING' &&
                  (user?.role === 'USER'
                    ? 'Diskusikan harga dengan mitra sebelum pembayaran'
                    : 'Diskusikan kebutuhan dan tentukan harga final untuk pelanggan')}
                {order.status === 'AWAITING_PAYMENT' &&
                  (user?.role === 'USER'
                    ? 'Harga final sudah ditentukan. Silakan bayar untuk mengirim pesanan ke mitra'
                    : 'Menunggu pelanggan membayar harga yang sudah disepakati')}
                {order.status === 'PENDING' && 'Menunggu konfirmasi dari mitra'}
                {order.status === 'CONFIRMED' && 'Mitra akan datang sesuai jadwal'}
                {order.status === 'IN_PROGRESS' && 'Pekerjaan sedang berlangsung'}
                {order.status === 'AWAITING_USER_CONFIRMATION' &&
                  (user?.role === 'USER'
                    ? 'Mitra menandai pekerjaan selesai — konfirmasi untuk melepas pembayaran'
                    : 'Menunggu pelanggan mengonfirmasi sebelum dana dicairkan')}
                {order.status === 'COMPLETED' && 'Pekerjaan telah selesai'}
                {order.status === 'CANCELLED' && 'Pesanan telah dibatalkan'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Timeline */}
        {order.status !== 'CANCELLED' && (
          <div className="card p-6">
            <h3 className="font-heading font-semibold text-secondary mb-4">Status Pesanan</h3>
            <div className="status-timeline">
              {timelineLabels.map((label, index) => {
                const stepNum = index + 1;
                const isCompleted = status.step >= stepNum;
                const isActive = status.step === stepNum;
                
                return (
                  <div key={index} className={`status-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                    <div className="step-icon">
                      {isCompleted && stepNum < status.step ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <span className="text-xs">{stepNum}</span>
                      )}
                    </div>
                    <span className={`text-xs ${isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Service Details */}
        <div className="card p-6">
          <h3 className="font-heading font-semibold text-secondary mb-4">Detail Layanan</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">🔧</span>
              </div>
              <div>
                <p className="font-medium text-secondary">{order.service_name}</p>
                <p className="text-sm text-slate-500">{order.service_category}</p>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Tanggal:</span>
                <span className="font-medium">{order.scheduled_date}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Waktu:</span>
                <span className="font-medium">{order.scheduled_time}</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <span className="text-slate-500">Alamat:</span>
                <span className="font-medium">{order.address}</span>
              </div>
              {order.notes && (
                <div className="flex items-start gap-3 text-sm">
                  <MessageCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                  <span className="text-slate-500">Catatan:</span>
                  <span className="font-medium">{order.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mitra Info */}
        <div className="card p-6">
          <h3 className="font-heading font-semibold text-secondary mb-4">Mitra</h3>
          <div className="flex items-center gap-4">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${order.mitra_name}`}
              alt={order.mitra_name}
              className="w-14 h-14 rounded-xl"
            />
            <div className="flex-1">
              <p className="font-medium text-secondary">{order.mitra_name}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm text-slate-600">
                  {mitra?.mitra_profile?.rating?.toFixed(1) || '0.0'}
                </span>
              </div>
            </div>
            <a 
              href={`tel:${mitra?.phone || ''}`}
              className="p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Payment Info */}
        <div className="card border-primary/10 p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <h3 className="font-heading font-semibold text-secondary">Pembayaran</h3>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Total</span>
            <span className="font-heading text-2xl font-bold text-primary">
              Rp {order.total_amount?.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-3 rounded-lg bg-primary/10 p-3">
            <p className="text-sm text-primary">
              {order.status === 'NEGOTIATING'
                ? 'Belum ada pembayaran. Gunakan chat untuk menyepakati harga final.'
                : order.status === 'AWAITING_PAYMENT'
                  ? 'Harga final sudah siap dibayar. Dana akan masuk escrow setelah pembayaran berhasil.'
                  : order.status === 'AWAITING_USER_CONFIRMATION'
                    ? 'Dana masih di escrow hingga Anda mengonfirmasi pekerjaan selesai'
                    : 'Dana disimpan di escrow - aman hingga pekerjaan selesai dan Anda mengonfirmasi'}
            </p>
          </div>
          {user?.role === 'USER' && order.status === 'AWAITING_PAYMENT' && (
            <button
              type="button"
              onClick={() => setPayConfirmOpen(true)}
              disabled={paying}
              className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="pay-agreed-price-btn"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Wallet className="h-4 w-4" />
              </span>
              <span>{paying ? 'Memproses pembayaran...' : 'Bayar harga yang disepakati'}</span>
            </button>
          )}
        </div>

        {/* Negotiation Chat */}
        <div className="card border-primary/10 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-secondary">Chat Negosiasi</h3>
            </div>
            {order.status === 'AWAITING_PAYMENT' && (
              <span className="badge badge-warning">Menunggu pembayaran</span>
            )}
          </div>

          <div
            ref={chatContainerRef}
            onScroll={rememberChatScrollPosition}
            className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-primary/5 p-3"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Belum ada pesan. Mulai diskusi harga dan kebutuhan layanan di sini.
              </p>
            ) : (
              messages.map((message) => {
                const isMine = message.sender_id === user?.id;
                const isPriceMessage = ['OFFER', 'FINAL_PRICE'].includes(message.message_type);
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm ${
                      isMine ? 'bg-primary text-white' : 'bg-white border border-slate-100 text-slate-700'
                    }`}>
                      <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                        <span>{message.sender_name}</span>
                        {isPriceMessage && (
                          <span className={`rounded-full px-2 py-0.5 ${
                            isMine ? 'bg-white/20' : 'bg-primary/10 text-primary'
                          }`}>
                            {message.message_type === 'OFFER' ? 'Penawaran' : 'Harga final'}
                          </span>
                        )}
                      </div>
                      {message.message && <p>{message.message}</p>}
                      {message.offer_amount && (
                        <p className="mt-2 font-heading text-base font-semibold">
                          {formatCurrency(message.offer_amount)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {canChat && (
            <div className="mt-4 space-y-3">
              <textarea
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="input min-h-[88px] resize-none"
                placeholder="Tulis pesan..."
                data-testid="order-chat-message"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSendTextMessage}
                  disabled={chatSubmitting || !chatText.trim()}
                  className="btn-secondary flex-1 disabled:opacity-50"
                  data-testid="send-chat-message"
                >
                  Kirim Pesan
                </button>
                {canUserOffer && (
                  <div className="flex flex-1 gap-2">
                    <input
                      type="number"
                      min="1"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      className="input"
                      placeholder="Penawaran (Rp)"
                      data-testid="offer-amount"
                    />
                    <button
                      type="button"
                      onClick={handleSendOffer}
                      disabled={chatSubmitting || !offerAmount}
                      className="btn-primary whitespace-nowrap disabled:opacity-50"
                      data-testid="send-offer"
                    >
                      Tawar
                    </button>
                  </div>
                )}
                {canMitraSetFinal && (
                  <div className="flex flex-1 gap-2">
                    <input
                      type="number"
                      min="1"
                      value={finalPrice}
                      onChange={(e) => setFinalPrice(e.target.value)}
                      className="input"
                      placeholder="Harga final (Rp)"
                      data-testid="final-price"
                    />
                    <button
                      type="button"
                      onClick={handleSetFinalPrice}
                      disabled={chatSubmitting || !finalPrice}
                      className="btn-primary whitespace-nowrap disabled:opacity-50"
                      data-testid="set-final-price"
                    >
                      Tetapkan
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* User Actions */}
          {user?.role === 'USER' && (
            <>
              {order.status === 'COMPLETED' && !showReview && (
                <button
                  onClick={() => setShowReview(true)}
                  className="btn-primary w-full"
                  data-testid="review-btn"
                >
                  Beri Ulasan
                </button>
              )}
              {order.status === 'AWAITING_USER_CONFIRMATION' && (
                <button
                  onClick={() => setCompleteConfirmOpen(true)}
                  className="btn-primary w-full"
                  data-testid="user-confirm-complete-btn"
                >
                  Konfirmasi pekerjaan selesai
                </button>
              )}
              {['NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING'].includes(order.status) && (
                <button
                  onClick={() => handleStatusUpdate('CANCELLED')}
                  className="btn-secondary w-full text-red-500 border-red-200 hover:bg-red-50"
                  data-testid="cancel-btn"
                >
                  Batalkan Pesanan
                </button>
              )}
            </>
          )}

          {/* Mitra Actions */}
          {user?.role === 'MITRA' && (
            <>
              {['NEGOTIATING', 'AWAITING_PAYMENT'].includes(order.status) && (
                <button
                  onClick={() => handleStatusUpdate('CANCELLED')}
                  className="btn-secondary w-full text-red-500 border-red-200 hover:bg-red-50"
                  data-testid="cancel-negotiation-btn"
                >
                  Batalkan Pesanan
                </button>
              )}
              {order.status === 'PENDING' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusUpdate('CONFIRMED')}
                    className="btn-primary flex-1"
                    data-testid="confirm-btn"
                  >
                    Terima Pesanan
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('CANCELLED')}
                    className="btn-secondary flex-1 text-red-500"
                    data-testid="reject-btn"
                  >
                    Tolak
                  </button>
                </div>
              )}
              {order.status === 'CONFIRMED' && (
                <button
                  onClick={() => handleStatusUpdate('IN_PROGRESS')}
                  className="btn-primary w-full"
                  data-testid="start-btn"
                >
                  Mulai Pengerjaan
                </button>
              )}
              {order.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => handleStatusUpdate('AWAITING_USER_CONFIRMATION')}
                  className="btn-primary w-full"
                  data-testid="complete-btn"
                >
                  Tandai selesai (tunggu konfirmasi pengguna)
                </button>
              )}
            </>
          )}
        </div>

        {/* Review Modal */}
        {showReview && (
          <div className="card p-6 animate-fade-in">
            <h3 className="font-heading font-semibold text-secondary mb-4">Beri Ulasan</h3>
            
            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-2">Rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setReview({ ...review, rating: star })}
                    className="p-1"
                    data-testid={`star-${star}`}
                  >
                    <Star 
                      className={`w-8 h-8 transition-colors ${
                        star <= review.rating 
                          ? 'text-yellow-400 fill-yellow-400' 
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-2">Komentar (opsional)</p>
              <textarea
                value={review.comment}
                onChange={(e) => setReview({ ...review, comment: e.target.value })}
                className="input min-h-[100px] resize-none"
                placeholder="Bagikan pengalaman Anda..."
                data-testid="review-comment"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={submitting}
                className="btn-primary flex-1"
                data-testid="submit-review-btn"
              >
                {submitting ? 'Mengirim...' : 'Kirim Ulasan'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={payConfirmOpen}
        title="Bayar harga yang disepakati?"
        description="Saldo wallet Anda akan dipotong dan dana disimpan di escrow sampai pekerjaan selesai."
        confirmLabel="Bayar sekarang"
        loading={paying}
        onCancel={() => !paying && setPayConfirmOpen(false)}
        onConfirm={handlePayOrder}
      >
        <div className="mt-4 rounded-xl bg-primary/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Total pembayaran</p>
          <p className="mt-1 font-heading text-2xl font-bold text-primary">
            {formatCurrency(agreedAmount)}
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={insufficientOpen}
        title="Saldo wallet tidak cukup"
        description="Saldo wallet Anda tidak cukup. Apakah Anda ingin top up sekarang?"
        confirmLabel="Top Up Sekarang"
        cancelLabel="Nanti"
        onCancel={() => setInsufficientOpen(false)}
        onConfirm={() => {
          setInsufficientOpen(false);
          setTopupOpen(true);
        }}
      >
        <div className="mt-4 grid gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex justify-between gap-3">
            <span>Saldo saat ini</span>
            <span className="font-semibold">{formatCurrency(walletBalance || 0)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Kekurangan</span>
            <span className="font-semibold">{formatCurrency(walletShortage)}</span>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={completeConfirmOpen}
        title="Konfirmasi pekerjaan selesai?"
        description="Pastikan pekerjaan sudah sesuai. Dana escrow akan dicairkan ke mitra setelah Anda mengonfirmasi."
        confirmLabel="Konfirmasi selesai"
        onCancel={() => setCompleteConfirmOpen(false)}
        onConfirm={handleUserConfirmCompleted}
      />

      <WalletTopUpModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        onSuccess={handleTopUpSuccess}
        initialAmount={suggestedTopupAmount}
      />
    </div>
  );
};

export default OrderDetailPage;
