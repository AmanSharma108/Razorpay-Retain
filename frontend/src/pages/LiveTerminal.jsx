import React, { useState, useEffect } from 'react';
import { 
  CreditCard, ShoppingCart, FileText, Send, 
  ExternalLink, Copy, Check, RefreshCw, ShieldCheck, 
  AlertTriangle, ShieldAlert, Sparkles, Globe, Radio, Play
} from 'lucide-react';
import { checkoutAPI, pollingAPI } from '../api/client';
import { formatRupee } from '../utils/formatters';
import { triggerConfetti } from '../utils/confetti';
import { toast } from 'sonner';

export default function LiveTerminal() {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Standard Checkout Form State
  const [checkoutAmount, setCheckoutAmount] = useState('12500');
  const [customerName, setCustomerName] = useState('Ananya Sharma');
  const [customerEmail, setCustomerEmail] = useState('ananya.sharma@enterprise.in');
  const [customerPhone, setCustomerPhone] = useState('+919876543210');
  const [orderDescription, setOrderDescription] = useState('Enterprise Cloud License Tier 2');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);

  // Payment Link Form State
  const [linkAmount, setLinkAmount] = useState('4500');
  const [linkEmail, setLinkEmail] = useState('rahul.verma@techcorp.io');
  const [linkPhone, setLinkPhone] = useState('+919988776655');
  const [linkDesc, setLinkDesc] = useState('Custom Recovery Payment Link');
  const [linkLoading, setLinkLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);

  // Invoice Form State
  const [invAmount, setInvAmount] = useState('35000');
  const [invName, setInvName] = useState('Acme Corp India');
  const [invEmail, setInvEmail] = useState('billing@acmecorp.in');
  const [invPhone, setInvPhone] = useState('+919876500000');
  const [invDesc, setInvDesc] = useState('Quarterly API Infrastructure Retainer');
  const [invLoading, setInvLoading] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  // Polling Sync State
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // Copy helpers
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await checkoutAPI.getConfig();
      setConfig(res.data);
    } catch (err) {
      console.error('Failed to load gateway config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const copyToClipboard = (text, fieldKey) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Launch Real Razorpay Standard Checkout
  const handleLaunchCheckout = async () => {
    if (!window.Razorpay) {
      toast.error('Razorpay SDK not loaded', {
        description: 'Please check your internet connection and reload the page.'
      });
      return;
    }

    const amountPaise = Math.round((parseFloat(checkoutAmount) || 500) * 100);
    if (amountPaise <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setCheckoutLoading(true);
    toast.info('Creating Order in Razorpay Test API...', { duration: 2500 });

    try {
      const orderRes = await checkoutAPI.createOrder({
        amount: amountPaise,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_contact: customerPhone,
        notes: {
          item_description: orderDescription,
          created_via: 'Razorpay Retain Live Terminal'
        }
      });

      const orderData = orderRes.data;
      setLastCreatedOrder(orderData);

      const options = {
        key: config?.key_id || orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Razorpay Retain Merchant',
        description: orderDescription,
        order_id: orderData.id,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: {
          color: '#3395FF',
        },
        handler: async function (response) {
          triggerConfetti();
          toast.success('Payment Captured via Razorpay!', {
            description: `Payment ID: ${response.razorpay_payment_id}`
          });
          setTimeout(async () => {
            await pollingAPI.triggerPoll();
            window.dispatchEvent(new CustomEvent('review-queue-changed', {}));
          }, 1500);
        },
        modal: {
          ondismiss: async function () {
            toast.warning('Checkout Dismissed / Abandoned', {
              description: 'Sending dropoff signal to recovery orchestrator...'
            });
            try {
              await checkoutAPI.notifyFailure({
                order_id: orderData.id,
                amount: orderData.amount,
                customer_email: customerEmail,
                customer_contact: customerPhone,
                error_code: 'BAD_REQUEST_ERROR',
                error_description: 'Checkout modal dismissed before payment completion'
              });
              toast.info('Cart Abandonment Intercepted & Diagnosed');
              window.dispatchEvent(new CustomEvent('review-queue-changed', {}));
            } catch (err) {
              console.error('Failed to notify abandonment:', err);
            }
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', async function (response) {
        toast.error('Payment Declined at Gateway', {
          description: response.error?.description || 'Gateway error recorded'
        });

        try {
          await checkoutAPI.notifyFailure({
            order_id: orderData.id,
            payment_id: response.error?.metadata?.payment_id,
            amount: orderData.amount,
            customer_email: customerEmail,
            customer_contact: customerPhone,
            error_code: response.error?.code || 'GATEWAY_ERROR',
            error_description: response.error?.description || 'Card payment declined',
            error_source: response.error?.source || 'gateway',
            error_step: response.error?.step || 'payment_authorization',
            error_reason: response.error?.reason || 'payment_failed'
          });
          toast.success('Incident Intercepted by Razorpay Retain!');
          window.dispatchEvent(new CustomEvent('review-queue-changed', {}));
        } catch (err) {
          console.error('Failed to report failure:', err);
        }
      });

      rzpInstance.open();
    } catch (error) {
      console.error('Failed to initialize checkout:', error);
      toast.error('Order creation failed on Razorpay API', {
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Generate Real Razorpay Payment Link
  const handleGenerateLink = async (e) => {
    e.preventDefault();
    const amountPaise = Math.round((parseFloat(linkAmount) || 100) * 100);
    setLinkLoading(true);

    try {
      const res = await checkoutAPI.createPaymentLink({
        amount: amountPaise,
        currency: 'INR',
        description: linkDesc,
        customer_email: linkEmail,
        customer_contact: linkPhone,
        notify_sms: true,
        notify_email: true,
        notes: {
          generated_via: 'Live Recovery Terminal'
        }
      });
      setGeneratedLink(res.data);
      toast.success('Real Razorpay Payment Link Created!', {
        description: `Link: ${res.data.short_url}`
      });
    } catch (error) {
      console.error('Link creation failed:', error);
      toast.error('Failed to create Payment Link', {
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setLinkLoading(false);
    }
  };

  // Generate Real Razorpay Invoice
  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    const amountPaise = Math.round((parseFloat(invAmount) || 500) * 100);
    setInvLoading(true);

    try {
      const res = await checkoutAPI.createInvoice({
        amount: amountPaise,
        currency: 'INR',
        description: invDesc,
        customer_name: invName,
        customer_email: invEmail,
        customer_contact: invPhone,
        notes: {
          created_via: 'B2B Dunning Terminal'
        }
      });
      setGeneratedInvoice(res.data);
      toast.success('Real Razorpay B2B Invoice Issued!', {
        description: `Invoice ID: ${res.data.id}`
      });
    } catch (error) {
      console.error('Invoice creation failed:', error);
      toast.error('Failed to create Invoice', {
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setInvLoading(false);
    }
  };

  // Trigger Immediate Polling Safety Net Sync
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await checkoutAPI.syncNow();
      setLastSyncResult(res.data);
      toast.success('Gateway Polling Safety Net Complete', {
        description: `Ingested ${res.data.new_events} new incidents | Checked ${res.data.skipped_duplicates} existing records`
      });
      window.dispatchEvent(new CustomEvent('review-queue-changed', {}));
    } catch (err) {
      console.error('Sync failed:', err);
      toast.error('Failed to sync gateway');
    } finally {
      setSyncing(false);
    }
  };

  const testCards = [
    {
      title: 'Insufficient Funds Decline',
      number: '4384 7968 2770 3274',
      exp: '12/28',
      cvv: '123',
      outcome: 'Fails with Insufficient Funds (Auto Recovery Link)'
    },
    {
      title: 'Bank Issuer Decline',
      number: '5312 6865 5677 9641',
      exp: '12/28',
      cvv: '123',
      outcome: 'Fails with Issuer Decline (Alternate Payment Rail)'
    },
    {
      title: 'UPI Collect Failure',
      vpa: 'failure@razorpay',
      outcome: 'Declined UPI Collect (Friction Reduction Switch)'
    },
    {
      title: 'Success Card (Captured)',
      number: '4111 1111 1111 1111',
      exp: '12/28',
      cvv: '123',
      outcome: 'Success & captured (Bandit Posterior Reward +1)'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-heading font-bold text-[var(--ink-primary)] tracking-tight">
              Live Gateway & Real Checkout Sandbox
            </h1>
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[var(--status-success-subtle)] text-[var(--status-success)] border border-[var(--status-success)]/30 font-mono text-[10px] font-bold">
              <Globe size={11} className="mr-1" />
              Razorpay Test API
            </span>
          </div>
          <p className="text-[var(--ink-muted)] text-xs mt-0.5">
            Test real-world checkout transactions, inspect live webhook payloads, and trigger genuine recovery links.
          </p>
        </div>

        <button
          onClick={handleSyncNow}
          disabled={syncing}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--ink-primary)] text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'Syncing...' : 'Sync Gateway Safety Net'}</span>
        </button>
      </div>

      {/* Gateway Connection Specs Card */}
      <div className="p-4 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-md bg-[var(--accent-brand-subtle)] text-[var(--accent-brand)] flex items-center justify-center font-bold">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="text-[10px] text-[var(--ink-muted)] block uppercase">Active Key ID</span>
            <span className="text-[var(--ink-primary)] font-bold">
              {config?.key_id || 'rzp_test_...'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[var(--ink-muted)]">Webhook:</span>
          <span className="text-[11px] text-[var(--status-success)] bg-[var(--surface-card-subtle)] px-2 py-1 rounded border border-[var(--border-subtle)] font-bold">
            /api/webhooks/razorpay
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] inline-block" />
          <span className="text-[var(--status-success)] font-semibold text-xs font-sans">
            Dual-Path Ingestion Active
          </span>
        </div>
      </div>

      {/* Main Section: Real Razorpay Standard Checkout Launcher */}
      <div className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-[var(--accent-brand-subtle)] text-[var(--accent-brand)] flex items-center justify-center">
              <CreditCard size={16} />
            </div>
            <div>
              <h2 className="text-sm font-heading font-bold text-[var(--ink-primary)]">
                Live Razorpay Standard Checkout Modal
              </h2>
              <span className="text-[11px] text-[var(--ink-muted)] font-sans">
                Creates a real Order on Razorpay and launches the interactive payment popup.
              </span>
            </div>
          </div>

          <button
            onClick={handleLaunchCheckout}
            disabled={checkoutLoading}
            className="px-4 py-2 rounded-md bg-[var(--accent-brand)] hover:bg-[var(--accent-brand-hover)] text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <Play size={13} className={checkoutLoading ? 'animate-bounce' : ''} />
            <span>{checkoutLoading ? 'Creating Order...' : 'Launch Razorpay Checkout'}</span>
          </button>
        </div>

        {/* Input Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[var(--ink-muted)] mb-1 font-medium font-sans">Transaction Amount (₹)</label>
            <input
              type="number"
              value={checkoutAmount}
              onChange={(e) => setCheckoutAmount(e.target.value)}
              className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded-md px-3 py-1.5 text-xs text-[var(--ink-primary)] font-mono focus:outline-none focus:border-[var(--accent-brand)]"
            />
            <div className="flex space-x-1.5 mt-1.5 font-mono">
              <button 
                type="button" 
                onClick={() => setCheckoutAmount('500')}
                className="px-1.5 py-0.5 rounded bg-[var(--surface-card-subtle)] hover:bg-[var(--surface-hover)] text-[10px] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
              >
                ₹500 (Auto)
              </button>
              <button 
                type="button" 
                onClick={() => setCheckoutAmount('12500')}
                className="px-1.5 py-0.5 rounded bg-[var(--surface-card-subtle)] hover:bg-[var(--surface-hover)] text-[10px] text-[var(--status-warning)] border border-[var(--border-subtle)]"
              >
                ₹12.5k (Review)
              </button>
              <button 
                type="button" 
                onClick={() => setCheckoutAmount('45000')}
                className="px-1.5 py-0.5 rounded bg-[var(--surface-card-subtle)] hover:bg-[var(--surface-hover)] text-[10px] text-[var(--status-error)] border border-[var(--border-subtle)]"
              >
                ₹45k (Enterprise)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[var(--ink-muted)] mb-1 font-medium font-sans">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded-md px-3 py-1.5 text-xs text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)]"
            />
          </div>

          <div>
            <label className="block text-[var(--ink-muted)] mb-1 font-medium font-sans">Customer Email</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded-md px-3 py-1.5 text-xs text-[var(--ink-primary)] font-mono focus:outline-none focus:border-[var(--accent-brand)]"
            />
          </div>

          <div>
            <label className="block text-[var(--ink-muted)] mb-1 font-medium font-sans">Customer Phone</label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded-md px-3 py-1.5 text-xs text-[var(--ink-primary)] font-mono focus:outline-none focus:border-[var(--accent-brand)]"
            />
          </div>
        </div>

        {/* Real Order Created Telemetry Box */}
        {lastCreatedOrder && (
          <div className="p-3 rounded bg-[var(--surface-card-subtle)] border border-[var(--accent-brand)]/30 space-y-1 text-xs font-mono">
            <div className="flex items-center justify-between text-[var(--ink-primary)]">
              <span className="text-[var(--accent-brand)] font-bold">Razorpay Order #{lastCreatedOrder.id}</span>
              <span className="text-[var(--ink-muted)] tabular-nums">{formatRupee(lastCreatedOrder.amount)}</span>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Status: {lastCreatedOrder.status} • Receipts: {lastCreatedOrder.receipt || 'N/A'}
            </p>
          </div>
        )}
      </div>

      {/* Razorpay Test Cards Cheat Sheet */}
      <div className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-center space-x-2 border-b border-[var(--border-subtle)] pb-2">
          <CreditCard size={15} className="text-[var(--accent-brand)]" />
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-primary)]">
            Official Razorpay Test Cards Cheat-Sheet
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          {testCards.map((card, idx) => (
            <div key={idx} className="p-3 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] space-y-1.5 hover:border-[var(--border-strong)] transition-colors">
              <span className="font-sans font-semibold text-[var(--ink-primary)] block text-xs">
                {card.title}
              </span>
              {card.number && (
                <div className="flex items-center justify-between bg-[var(--surface-card)] p-1.5 rounded border border-[var(--border-subtle)] text-[11px]">
                  <span className="font-bold tabular-nums text-[var(--ink-primary)]">{card.number}</span>
                  <button
                    onClick={() => copyToClipboard(card.number.replace(/\s/g, ''), `card-${idx}`)}
                    className="text-[var(--ink-muted)] hover:text-[var(--accent-brand)] ml-1"
                    title="Copy card number"
                  >
                    {copiedField === `card-${idx}` ? <Check size={12} className="text-[var(--status-success)]" /> : <Copy size={12} />}
                  </button>
                </div>
              )}
              {card.vpa && (
                <div className="flex items-center justify-between bg-[var(--surface-card)] p-1.5 rounded border border-[var(--border-subtle)] text-[11px]">
                  <span className="font-bold text-[var(--ink-primary)]">{card.vpa}</span>
                  <button
                    onClick={() => copyToClipboard(card.vpa, `vpa-${idx}`)}
                    className="text-[var(--ink-muted)] hover:text-[var(--accent-brand)] ml-1"
                    title="Copy UPI VPA"
                  >
                    {copiedField === `vpa-${idx}` ? <Check size={12} className="text-[var(--status-success)]" /> : <Copy size={12} />}
                  </button>
                </div>
              )}
              <p className="text-[10px] text-[var(--ink-muted)] font-sans leading-tight pt-1">
                {card.outcome}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Column Tool: Real Payment Link Generator & Real Invoice Generator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Real Payment Link Generator */}
        <form onSubmit={handleGenerateLink} className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center space-x-2 border-b border-[var(--border-subtle)] pb-3">
            <Send size={15} className="text-[var(--accent-brand)]" />
            <div>
              <h3 className="text-xs font-heading font-bold text-[var(--ink-primary)]">
                Generate Razorpay Smart Recovery Link
              </h3>
              <p className="text-[11px] text-[var(--ink-muted)] font-sans">
                Calls Razorpay Payment Links API (`rzp.io/i/...`)
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[var(--ink-muted)] mb-1 font-sans">Amount (₹)</label>
                <input
                  type="number"
                  value={linkAmount}
                  onChange={(e) => setLinkAmount(e.target.value)}
                  className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded px-2.5 py-1.5 font-mono text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)]"
                />
              </div>
              <div>
                <label className="block text-[var(--ink-muted)] mb-1 font-sans">Customer Email</label>
                <input
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded px-2.5 py-1.5 font-mono text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[var(--ink-muted)] mb-1 font-sans">Description</label>
              <input
                type="text"
                value={linkDesc}
                onChange={(e) => setLinkDesc(e.target.value)}
                className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded px-2.5 py-1.5 text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)]"
              />
            </div>

            <button
              type="submit"
              disabled={linkLoading}
              className="w-full py-2 rounded bg-[var(--surface-card-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--ink-primary)] font-semibold shadow-sm transition-all flex items-center justify-center space-x-1.5"
            >
              <Send size={12} className="text-[var(--accent-brand)]" />
              <span>{linkLoading ? 'Creating Link...' : 'Generate Real Payment Link'}</span>
            </button>
          </div>

          {generatedLink && (
            <div className="p-3 rounded bg-[var(--surface-card-subtle)] border border-[var(--status-success)]/30 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[var(--status-success)] font-bold">
                <span>Link Ready: {generatedLink.id}</span>
                <span className="tabular-nums">{formatRupee(generatedLink.amount)}</span>
              </div>
              <div className="flex items-center justify-between bg-[var(--surface-card)] p-2 rounded border border-[var(--border-subtle)]">
                <span className="text-[11px] text-[var(--accent-brand)] truncate max-w-[240px]">
                  {generatedLink.short_url}
                </span>
                <a
                  href={generatedLink.short_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 rounded bg-[var(--accent-brand)] text-white font-bold text-[10px] flex items-center space-x-1"
                >
                  <span>Open & Pay</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}
        </form>

        {/* Real B2B Invoice Generator */}
        <form onSubmit={handleGenerateInvoice} className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center space-x-2 border-b border-[var(--border-subtle)] pb-3">
            <FileText size={15} className="text-[var(--accent-brand)]" />
            <div>
              <h3 className="text-xs font-heading font-bold text-[var(--ink-primary)]">
                Generate Razorpay B2B Invoice
              </h3>
              <p className="text-[11px] text-[var(--ink-muted)] font-sans">
                Calls Razorpay Invoices API with Net Dunning workflow
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[var(--ink-muted)] mb-1 font-sans">Amount (₹)</label>
                <input
                  type="number"
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded px-2.5 py-1.5 font-mono text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)]"
                />
              </div>
              <div>
                <label className="block text-[var(--ink-muted)] mb-1 font-sans">Company Name</label>
                <input
                  type="text"
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded px-2.5 py-1.5 text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[var(--ink-muted)] mb-1 font-sans">Billing Email</label>
              <input
                type="email"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded px-2.5 py-1.5 font-mono text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)]"
              />
            </div>

            <button
              type="submit"
              disabled={invLoading}
              className="w-full py-2 rounded bg-[var(--surface-card-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--ink-primary)] font-semibold shadow-sm transition-all flex items-center justify-center space-x-1.5"
            >
              <FileText size={12} className="text-[var(--accent-brand)]" />
              <span>{invLoading ? 'Creating Invoice...' : 'Generate Real Razorpay Invoice'}</span>
            </button>
          </div>

          {generatedInvoice && (
            <div className="p-3 rounded bg-[var(--surface-card-subtle)] border border-[var(--status-success)]/30 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[var(--status-success)] font-bold">
                <span>Invoice #{generatedInvoice.id}</span>
                <span className="tabular-nums">{formatRupee(generatedInvoice.amount)}</span>
              </div>
              <div className="flex items-center justify-between bg-[var(--surface-card)] p-2 rounded border border-[var(--border-subtle)]">
                <span className="text-[11px] text-[var(--accent-brand)] truncate max-w-[240px]">
                  {generatedInvoice.short_url || 'Invoice Issued'}
                </span>
                {generatedInvoice.short_url && (
                  <a
                    href={generatedInvoice.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded bg-[var(--accent-brand)] text-white font-bold text-[10px] flex items-center space-x-1"
                  >
                    <span>View Invoice</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
