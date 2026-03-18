import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatCurrency, generateIdempotencyKey } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, Send, HandCoins, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Transfers() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'external';
  const [tab, setTab] = useState(initialTab);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [payees, setPayees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [extFrom, setExtFrom] = useState('');
  const [extPayee, setExtPayee] = useState('');
  const [extAmount, setExtAmount] = useState('');
  const [extDesc, setExtDesc] = useState('');

  const [intFrom, setIntFrom] = useState('');
  const [intTo, setIntTo] = useState('');
  const [intAmount, setIntAmount] = useState('');
  const [intDesc, setIntDesc] = useState('');

  const [reqTo, setReqTo] = useState('');
  const [reqFromUser, setReqFromUser] = useState('');
  const [reqAmount, setReqAmount] = useState('');
  const [reqDesc, setReqDesc] = useState('');

  const refreshAccounts = useCallback(async () => {
    try {
      const data = await api.accounts.list();
      setAccounts(data.accounts);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([api.accounts.list(), api.payees.list()]).then(([a, p]) => {
      setAccounts(a.accounts);
      setPayees(p.payees);
      if (a.accounts.length > 0) {
        setExtFrom(a.accounts[0].id);
        setIntFrom(a.accounts[0].id);
        setReqTo(a.accounts[0].id);
        if (a.accounts.length > 1) setIntTo(a.accounts[1].id);
      }
      if (p.payees.length > 0) setExtPayee(p.payees[0].id);
    });
  }, []);

  const handleExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await api.transfers.external({
        from_account_id: extFrom,
        payee_id: extPayee,
        amount: parseFloat(extAmount),
        description: extDesc,
        idempotency_key: generateIdempotencyKey(),
      });
      setSuccess('Transfer sent successfully!');
      setExtAmount(''); setExtDesc('');
      await refreshAccounts();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await api.transfers.internal({
        from_account_id: intFrom,
        to_account_id: intTo,
        amount: parseFloat(intAmount),
        description: intDesc,
        idempotency_key: generateIdempotencyKey(),
      });
      setSuccess('Transfer completed!');
      setIntAmount(''); setIntDesc('');
      await refreshAccounts();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await api.transfers.requestMoney({
        to_account_id: reqTo,
        from_user_id: reqFromUser,
        amount: parseFloat(reqAmount),
        description: reqDesc,
        idempotency_key: generateIdempotencyKey(),
      });
      setSuccess('Money request sent!');
      setReqAmount(''); setReqDesc(''); setReqFromUser('');
      await refreshAccounts();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const tabs = [
    { id: 'external', label: 'Send Money', icon: Send },
    { id: 'internal', label: 'Internal Transfer', icon: ArrowLeftRight },
    { id: 'request', label: 'Request Money', icon: HandCoins },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transfers</h1>
        <p className="text-muted-foreground">Send, transfer, or request funds</p>
      </div>

      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); setSuccess(''); }}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      {tab === 'external' && (
        <Card>
          <CardHeader>
            <CardTitle>Send Money to Payee</CardTitle>
            <CardDescription>Transfer funds to an established payee</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleExternal} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>From Account</Label>
                  <Select value={extFrom} onChange={e => setExtFrom(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.account_name} ({formatCurrency(a.balance)})</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Payee</Label>
                  <Select value={extPayee} onChange={e => setExtPayee(e.target.value)}>
                    {payees.length === 0 && <option value="">No payees - add one first</option>}
                    {payees.map(p => (
                      <option key={p.id} value={p.id}>{p.payee_name} {p.nickname ? `(${p.nickname})` : ''}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={extAmount} onChange={e => setExtAmount(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Payment for..." value={extDesc} onChange={e => setExtDesc(e.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={loading || payees.length === 0}>
                {loading ? 'Sending...' : 'Send Money'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'internal' && (
        <Card>
          <CardHeader>
            <CardTitle>Internal Transfer</CardTitle>
            <CardDescription>Move funds between your own accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInternal} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={intFrom} onChange={e => setIntFrom(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.account_name} ({formatCurrency(a.balance)})</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Select value={intTo} onChange={e => setIntTo(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.account_name} ({formatCurrency(a.balance)})</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={intAmount} onChange={e => setIntAmount(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Transfer reason..." value={intDesc} onChange={e => setIntDesc(e.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={loading || accounts.length < 2}>
                {loading ? 'Transferring...' : 'Transfer'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'request' && (
        <Card>
          <CardHeader>
            <CardTitle>Request Money</CardTitle>
            <CardDescription>Send a money request to another user</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Receive Into</Label>
                  <Select value={reqTo} onChange={e => setReqTo(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.account_name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From User ID</Label>
                  <Input placeholder="john42@novapay" value={reqFromUser} onChange={e => setReqFromUser(e.target.value)} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={reqAmount} onChange={e => setReqAmount(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Reason for request..." value={reqDesc} onChange={e => setReqDesc(e.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Requesting...' : 'Send Request'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
