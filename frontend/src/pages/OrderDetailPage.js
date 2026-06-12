import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, Clock, Phone, Star,
  CheckCircle, AlertCircle, XCircle, MessageCircle, Wallet, Image as ImageIcon, Send, Tag
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getOrder,
  updateOrderStatus,
  getMitra,
  getOrderMessages,
  sendOrderMessage,
  payOrder,
  getWallet,
  getOrderOffers,
  createOffer,
  acceptOffer,
  rejectOffer,
  rateMitra,
  rateUser,
  getUserRating,
  buildOrderWsUrl
} from '../services/api';
import WalletTopUpModal, { MIN_TOPUP_IDR } from '../components/WalletTopUpModal';
import { toast } from 'sonner';

const statusConfig = {
  OPEN: { color: 'primary', label: 'Mencari Mitra', step: 0 },
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
const MAX_IMAGE_BYTES = 2_000_000;

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
        {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
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

const StarRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm text-slate-600">{label}</span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)} className="p-0.5">
          <Star className={`w-6 h-6 ${star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  </div>
);

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [mitra, setMitra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [offers, setOffers] = useState([]);
  const [chatText, setChatText] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [acceptLoading, setAcceptLoading] = useState(false);

  // Ratings
  const [mitraRating, setMitraRating] = useState({ quality: 5, punctuality: 5, friendliness: 5, professionalism: 5, comment: '' });
  const [userRating, setUserRating] = useState({ payment: 5, politeness: 5, clarity: 5, communication: 5, comment: '' });
  const [showMitraRating, setShowMitraRating] = useState(false);
  const [showUserRating, setShowUserRating] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [customerRating, setCustomerRating] = useState(null);

  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const pollingMessagesRef = useRef(false);
  const wsRef = useRef(null);

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

  const loadOffers = useCallback(async () => {
    try {
      const res = await getOrderOffers(orderId);
      setOffers(res.data);
    } catch {
      //
    }
  }, [orderId]);

  const loadOrder = useCallback(async () => {
    try {
      const [response, messagesRes, offersRes] = await Promise.all([
        getOrder(orderId),
        getOrderMessages(orderId).catch(() => ({ data: [] })),
        getOrderOffers(orderId).catch(() => ({ data: [] }))
      ]);
      setOrder(response.data);
      mergeMessages(messagesRes.data, { stickToBottom: true });
      setOffers(offersRes.data);

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

  // Realtime channel (WebSocket) with polling fallback.
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(buildOrderWsUrl(orderId));
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'message') {
            mergeMessages([payload.data]);
          } else if (payload.event === 'offer' || payload.event === 'offer_rejected') {
            loadOffers();
            loadMessages();
          } else if (payload.event === 'status') {
            loadOrder();
          }
        } catch {
          //
        }
      };
    } catch {
      //
    }
    return () => {
      if (ws) {
        ws.onmessage = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [orderId, mergeMessages, loadOffers, loadMessages, loadOrder]);

  // Polling fallback keeps things in sync if the socket drops.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const open = wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
      if (!open) {
        loadMessages();
        loadOffers();
      }
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [loadMessages, loadOffers]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Mitra can view the customer's (mitra-only) rating once an order exists.
  useEffect(() => {
    if (user?.role === 'MITRA' && order?.user_id) {
      getUserRating(order.user_id)
        .then((res) => setCustomerRating(res.data))
        .catch(() => setCustomerRating(null));
    }
  }, [user?.role, order?.user_id]);

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
      const response = await sendOrderMessage(orderId, { message: text, message_type: 'TEXT' });
      setChatText('');
      mergeMessages([response.data], { stickToBottom: true });
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal mengirim pesan');
    } finally {
      setChatSubmitting(false);
    }
  };

  const handleImageSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Ukuran gambar maksimal 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setChatSubmitting(true);
      try {
        const response = await sendOrderMessage(orderId, {
          message_type: 'IMAGE',
          image_data: reader.result
        });
        mergeMessages([response.data], { stickToBottom: true });
      } catch (error) {
        const detail = error.response?.data?.detail;
        toast.error(typeof detail === 'string' ? detail : 'Gagal mengirim gambar');
      } finally {
        setChatSubmitting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendOffer = async () => {
    const amount = Number(offerInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Masukkan nominal penawaran yang valid');
      return;
    }
    setChatSubmitting(true);
    try {
      await createOffer(orderId, { amount, message: chatText.trim() || null });
      setOfferInput('');
      setChatText('');
      setShowOfferForm(false);
      await Promise.all([loadOffers(), loadMessages()]);
      toast.success('Penawaran terkirim');
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal mengirim penawaran');
    } finally {
      setChatSubmitting(false);
    }
  };

  const handleRejectOffer = async (offer) => {
    try {
      await rejectOffer(offer.id);
      await Promise.all([loadOffers(), loadMessages()]);
      toast.success('Penawaran ditolak');
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal menolak penawaran');
    }
  };

  const handleAcceptOffer = async () => {
    if (!acceptTarget) return;
    setAcceptLoading(true);
    try {
      await acceptOffer(acceptTarget.id);
      setAcceptTarget(null);
      toast.success('Penawaran diterima');
      await loadOrder();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal menerima penawaran');
    } finally {
      setAcceptLoading(false);
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

  const handleMitraRatingSubmit = async () => {
    setRatingSubmitting(true);
    try {
      await rateMitra({ order_id: orderId, ...mitraRating });
      toast.success('Terima kasih atas penilaian Anda!');
      setShowMitraRating(false);
      loadOrder();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengirim penilaian');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleUserRatingSubmit = async () => {
    setRatingSubmitting(true);
    try {
      await rateUser({ order_id: orderId, ...userRating });
      toast.success('Penilaian pelanggan terkirim');
      setShowUserRating(false);
      if (order?.user_id) {
        getUserRating(order.user_id).then((res) => setCustomerRating(res.data)).catch(() => {});
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengirim penilaian');
    } finally {
      setRatingSubmitting(false);
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

  const status = statusConfig[order.status] || { color: 'info', label: order.status, step: 0 };
  const isNegotiating = order.status === 'NEGOTIATING' && !order.negotiation_locked;
  const canChat = isNegotiating;
  const activeOffer = offers.find((o) => o.status === 'PENDING') || null;
  const agreedAmount = Number(order.final_price || order.total_amount || 0);
  const walletShortage = walletBalance === null ? 0 : Math.max(0, agreedAmount - walletBalance);
  const suggestedTopupAmount = Math.max(walletShortage, MIN_TOPUP_IDR);

  return (
    <div className="min-h-screen bg-background">
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
              <p className="text-sm text-slate-600">
                {order.status === 'OPEN' && 'Pesanan menunggu Anda memilih mitra.'}
                {order.status === 'NEGOTIATING' &&
                  (user?.role === 'USER'
                    ? 'Diskusikan kebutuhan dan tawar harga dengan mitra.'
                    : 'Pelanggan memilih Anda. Diskusikan kebutuhan dan sepakati harga.')}
                {order.status === 'AWAITING_PAYMENT' &&
                  (user?.role === 'USER'
                    ? 'Harga sudah disepakati. Silakan bayar untuk melanjutkan.'
                    : 'Menunggu pelanggan membayar harga yang disepakati.')}
                {order.status === 'PENDING' && 'Menunggu konfirmasi dari mitra.'}
                {order.status === 'CONFIRMED' && 'Mitra akan datang sesuai jadwal.'}
                {order.status === 'IN_PROGRESS' && 'Pekerjaan sedang berlangsung.'}
                {order.status === 'AWAITING_USER_CONFIRMATION' &&
                  (user?.role === 'USER'
                    ? 'Mitra menandai pekerjaan selesai - konfirmasi untuk melepas pembayaran.'
                    : 'Menunggu pelanggan mengonfirmasi sebelum dana dicairkan.')}
                {order.status === 'COMPLETED' && 'Pekerjaan telah selesai.'}
                {order.status === 'CANCELLED' && 'Pesanan telah dibatalkan.'}
              </p>
            </div>
          </div>
          {order.status === 'OPEN' && user?.role === 'USER' && (
            <button
              onClick={() => navigate(`/orders/${orderId}/choose-mitra`)}
              className="btn-primary mt-4 w-full"
              data-testid="go-choose-mitra"
            >
              Pilih Mitra Sekarang
            </button>
          )}
        </div>

        {/* Progress Timeline */}
        {!['CANCELLED', 'OPEN'].includes(order.status) && (
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
                    <span className={`text-xs ${isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
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
              {order.description && (
                <div className="flex items-start gap-3 text-sm">
                  <MessageCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                  <span className="text-slate-500">Kebutuhan:</span>
                  <span className="font-medium">{order.description}</span>
                </div>
              )}
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
        {order.mitra_id && (
          <div className="card p-6">
            <h3 className="font-heading font-semibold text-secondary mb-4">Mitra</h3>
            <div className="flex items-center gap-4">
              <img
                src={mitra?.mitra_profile?.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${order.mitra_name}`}
                alt={order.mitra_name}
                className="w-14 h-14 rounded-xl bg-slate-100 object-cover"
              />
              <div className="flex-1">
                <p className="font-medium text-secondary">{order.mitra_name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm text-slate-600">
                    {Number(mitra?.mitra_profile?.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({mitra?.mitra_profile?.review_count || 0} review)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/mitras/${order.mitra_id}`)}
                  className="text-xs text-primary font-medium mt-2 hover:underline"
                >
                  Lihat profil mitra
                </button>
              </div>
              <a
                href={`tel:${mitra?.phone || ''}`}
                className="p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Phone className="w-5 h-5" />
              </a>
            </div>
          </div>
        )}

        {/* Customer rating (mitra-only) */}
        {user?.role === 'MITRA' && customerRating && customerRating.rating_count > 0 && (
          <div className="card p-6">
            <h3 className="font-heading font-semibold text-secondary mb-2">Reputasi Pelanggan</h3>
            <p className="text-xs text-slate-400 mb-3">Hanya terlihat oleh mitra</p>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="font-heading text-lg font-bold text-secondary">
                {Number(customerRating.rating || 0).toFixed(1)}
              </span>
              <span className="text-sm text-slate-500">dari {customerRating.rating_count} penilaian</span>
            </div>
            {order.user_id && (
              <button
                type="button"
                onClick={() => navigate(`/users/${order.user_id}/profile`)}
                className="text-xs text-primary font-medium mt-3 hover:underline"
              >
                Lihat profil pelanggan
              </button>
            )}
          </div>
        )}

        {/* Payment Info */}
        {order.mitra_id && (
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
                  ? 'Belum ada pembayaran. Sepakati harga lewat penawaran terlebih dahulu.'
                  : order.status === 'AWAITING_PAYMENT'
                    ? 'Harga sudah disepakati. Dana akan masuk escrow setelah pembayaran berhasil.'
                    : order.status === 'AWAITING_USER_CONFIRMATION'
                      ? 'Dana masih di escrow hingga Anda mengonfirmasi pekerjaan selesai.'
                      : 'Dana disimpan di escrow - aman hingga pekerjaan selesai dan Anda mengonfirmasi.'}
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
        )}

        {/* Negotiation Chat */}
        {order.mitra_id && !['CANCELLED'].includes(order.status) && (
          <div className="card border-primary/10 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-semibold text-secondary">Chat Negosiasi</h3>
              </div>
              {order.negotiation_locked && <span className="badge badge-warning">Terkunci</span>}
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
                  if (message.message_type === 'SYSTEM') {
                    return (
                      <div key={getMessageKey(message)} className="flex justify-center">
                        <span className="rounded-full bg-slate-200/70 px-3 py-1 text-xs text-slate-600 text-center max-w-[90%]">
                          {message.message}
                        </span>
                      </div>
                    );
                  }
                  const isMine = message.sender_id === user?.id;
                  const isOffer = ['PRICE_OFFER', 'OFFER', 'FINAL_PRICE'].includes(message.message_type);
                  const isImage = message.message_type === 'IMAGE';
                  return (
                    <div key={getMessageKey(message)} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm ${
                        isMine ? 'bg-primary text-white' : 'bg-white border border-slate-100 text-slate-700'
                      }`}>
                        <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                          <span>{message.sender_name}</span>
                          {isOffer && (
                            <span className={`rounded-full px-2 py-0.5 ${isMine ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                              Penawaran
                            </span>
                          )}
                        </div>
                        {isImage && message.image_data && (
                          <img src={message.image_data} alt="Lampiran" className="mb-1 max-h-48 rounded-lg" />
                        )}
                        {message.message && <p>{message.message}</p>}
                        {isOffer && message.offer_amount && (
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

            {canChat ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  className="input min-h-[72px] resize-none"
                  placeholder="Tulis pesan..."
                  data-testid="order-chat-message"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSendTextMessage}
                    disabled={chatSubmitting || !chatText.trim()}
                    className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                    data-testid="send-chat-message"
                  >
                    <Send className="w-4 h-4" /> Kirim
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={chatSubmitting}
                    className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
                    data-testid="send-image"
                  >
                    <ImageIcon className="w-4 h-4" /> Gambar
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelected}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOfferForm((v) => !v)}
                    className="btn-secondary inline-flex items-center gap-2 ml-auto"
                    data-testid="open-offer-form"
                  >
                    <Tag className="w-4 h-4" /> Ajukan Penawaran
                  </button>
                </div>

                {showOfferForm && (
                  <div className="flex gap-2 rounded-xl bg-slate-50 p-3">
                    <input
                      type="number"
                      min="1"
                      value={offerInput}
                      onChange={(e) => setOfferInput(e.target.value)}
                      className="input"
                      placeholder="Nominal penawaran (Rp)"
                      data-testid="offer-amount"
                    />
                    <button
                      type="button"
                      onClick={handleSendOffer}
                      disabled={chatSubmitting || !offerInput}
                      className="btn-primary whitespace-nowrap disabled:opacity-50"
                      data-testid="submit-offer"
                    >
                      Kirim Penawaran
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">
                Chat dikunci karena harga sudah disepakati atau pesanan telah berlanjut.
              </p>
            )}
          </div>
        )}

        {/* Active offer card */}
        {(isNegotiating || order.status === 'AWAITING_PAYMENT') && (activeOffer || order.base_price != null) && (
          <div className="card border-primary/20 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-secondary">Penawaran Harga</h3>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Harga dasar mitra</span>
                <span className="font-medium">{formatCurrency(order.base_price || order.initial_price)}</span>
              </div>
              {activeOffer && (
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Penawaran aktif ({activeOffer.sender_role === 'USER' ? 'Pelanggan' : 'Mitra'})
                  </span>
                  <span className="font-heading text-lg font-bold text-primary">
                    {formatCurrency(activeOffer.amount)}
                  </span>
                </div>
              )}
            </div>

            {isNegotiating && activeOffer && activeOffer.sender_id !== user?.id && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setAcceptTarget(activeOffer)}
                  className="btn-primary flex-1"
                  data-testid="accept-offer"
                >
                  Terima
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectOffer(activeOffer)}
                  className="btn-secondary flex-1 text-red-500 border-red-200 hover:bg-red-50"
                  data-testid="reject-offer"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfferForm(true)}
                  className="btn-secondary flex-1"
                  data-testid="counter-offer"
                >
                  Tawar Balik
                </button>
              </div>
            )}
            {isNegotiating && activeOffer && activeOffer.sender_id === user?.id && (
              <p className="mt-3 text-sm text-slate-500">Menunggu respon dari pihak lain atas penawaran Anda.</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {user?.role === 'USER' && (
            <>
              {order.status === 'COMPLETED' && (
                <button
                  onClick={() => setShowMitraRating(true)}
                  className="btn-primary w-full"
                  data-testid="rate-mitra-btn"
                >
                  Beri Penilaian Mitra
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
              {['OPEN', 'NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING'].includes(order.status) && (
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

          {user?.role === 'MITRA' && (
            <>
              {order.status === 'COMPLETED' && (
                <button
                  onClick={() => setShowUserRating(true)}
                  className="btn-primary w-full"
                  data-testid="rate-user-btn"
                >
                  Nilai Pelanggan
                </button>
              )}
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
                  <button onClick={() => handleStatusUpdate('CONFIRMED')} className="btn-primary flex-1" data-testid="confirm-btn">
                    Terima Pesanan
                  </button>
                  <button onClick={() => handleStatusUpdate('CANCELLED')} className="btn-secondary flex-1 text-red-500" data-testid="reject-btn">
                    Tolak
                  </button>
                </div>
              )}
              {order.status === 'CONFIRMED' && (
                <button onClick={() => handleStatusUpdate('IN_PROGRESS')} className="btn-primary w-full" data-testid="start-btn">
                  Mulai Pengerjaan
                </button>
              )}
              {order.status === 'IN_PROGRESS' && (
                <button onClick={() => handleStatusUpdate('AWAITING_USER_CONFIRMATION')} className="btn-primary w-full" data-testid="complete-btn">
                  Tandai selesai (tunggu konfirmasi pengguna)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Accept offer confirmation modal */}
      <ConfirmDialog
        open={!!acceptTarget}
        title="Apakah Anda yakin menerima penawaran ini?"
        confirmLabel="Ya, terima"
        loading={acceptLoading}
        onCancel={() => !acceptLoading && setAcceptTarget(null)}
        onConfirm={handleAcceptOffer}
      >
        {acceptTarget && (
          <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Jenis Jasa</span><span className="font-medium">{order.service_name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Nama Mitra</span><span className="font-medium">{order.mitra_name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Harga Awal</span><span className="font-medium">{formatCurrency(order.base_price || order.initial_price)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Harga Deal</span><span className="font-heading font-bold text-primary">{formatCurrency(acceptTarget.amount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tanggal</span><span className="font-medium">{order.scheduled_date}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Jam</span><span className="font-medium">{order.scheduled_time}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Alamat</span><span className="font-medium text-right">{order.address}</span></div>
          </div>
        )}
      </ConfirmDialog>

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
          <p className="mt-1 font-heading text-2xl font-bold text-primary">{formatCurrency(agreedAmount)}</p>
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
          <div className="flex justify-between gap-3"><span>Saldo saat ini</span><span className="font-semibold">{formatCurrency(walletBalance || 0)}</span></div>
          <div className="flex justify-between gap-3"><span>Kekurangan</span><span className="font-semibold">{formatCurrency(walletShortage)}</span></div>
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

      {/* Mitra rating modal (user rates mitra) */}
      <ConfirmDialog
        open={showMitraRating}
        title="Beri Penilaian Mitra"
        confirmLabel="Kirim Penilaian"
        loading={ratingSubmitting}
        onCancel={() => !ratingSubmitting && setShowMitraRating(false)}
        onConfirm={handleMitraRatingSubmit}
      >
        <div className="mt-4 space-y-3">
          <StarRow label="Kualitas Kerja" value={mitraRating.quality} onChange={(v) => setMitraRating({ ...mitraRating, quality: v })} />
          <StarRow label="Ketepatan Waktu" value={mitraRating.punctuality} onChange={(v) => setMitraRating({ ...mitraRating, punctuality: v })} />
          <StarRow label="Keramahan" value={mitraRating.friendliness} onChange={(v) => setMitraRating({ ...mitraRating, friendliness: v })} />
          <StarRow label="Profesionalitas" value={mitraRating.professionalism} onChange={(v) => setMitraRating({ ...mitraRating, professionalism: v })} />
          <textarea
            value={mitraRating.comment}
            onChange={(e) => setMitraRating({ ...mitraRating, comment: e.target.value })}
            className="input min-h-[80px] resize-none"
            placeholder="Komentar (opsional)..."
            data-testid="mitra-rating-comment"
          />
        </div>
      </ConfirmDialog>

      {/* User rating modal (mitra rates user) */}
      <ConfirmDialog
        open={showUserRating}
        title="Nilai Pelanggan"
        description="Penilaian ini hanya terlihat oleh sesama mitra, tidak terlihat oleh pelanggan."
        confirmLabel="Kirim Penilaian"
        loading={ratingSubmitting}
        onCancel={() => !ratingSubmitting && setShowUserRating(false)}
        onConfirm={handleUserRatingSubmit}
      >
        <div className="mt-4 space-y-3">
          <StarRow label="Pembayaran" value={userRating.payment} onChange={(v) => setUserRating({ ...userRating, payment: v })} />
          <StarRow label="Kesopanan" value={userRating.politeness} onChange={(v) => setUserRating({ ...userRating, politeness: v })} />
          <StarRow label="Kejelasan Instruksi" value={userRating.clarity} onChange={(v) => setUserRating({ ...userRating, clarity: v })} />
          <StarRow label="Komunikasi" value={userRating.communication} onChange={(v) => setUserRating({ ...userRating, communication: v })} />
          <textarea
            value={userRating.comment}
            onChange={(e) => setUserRating({ ...userRating, comment: e.target.value })}
            className="input min-h-[80px] resize-none"
            placeholder="Komentar (opsional)..."
            data-testid="user-rating-comment"
          />
        </div>
      </ConfirmDialog>

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
