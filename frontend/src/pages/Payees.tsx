import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Users, AlertCircle, CheckCircle2, Loader2, Search } from 'lucide-react';

interface Payee {
  id: string;
  payee_name: string;
  payee_user_id: string | null;
  payee_account_id: string | null;
  nickname: string | null;
  created_at: string;
}

interface LookupResult {
  user_id: string;
  full_name: string;
  checking_account_id: string | null;
}

export default function Payees() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Payee | null>(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [nickname, setNickname] = useState('');

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadPayees(); }, []);

  const loadPayees = async () => {
    try {
      const data = await api.payees.list();
      setPayees(data.payees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(''); setUserId(''); setAccountId(''); setNickname('');
    setError(''); setLookupDone(false); setLookupError('');
  };

  const lookupUser = useCallback(async (id: string) => {
    if (!id || id.length < 5) {
      setLookupDone(false);
      setLookupError('');
      return;
    }

    setLookupLoading(true);
    setLookupError('');
    setLookupDone(false);

    try {
      const data: LookupResult = await api.users.lookup(id);
      setName(data.full_name);
      setAccountId(data.checking_account_id ?? '');
      setLookupDone(true);
    } catch (err: any) {
      setLookupError(err.message);
      setName('');
      setAccountId('');
      setLookupDone(false);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const handleUserIdChange = (value: string) => {
    setUserId(value);
    setLookupDone(false);
    setLookupError('');
    setName('');
    setAccountId('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length >= 5) {
      debounceRef.current = setTimeout(() => lookupUser(value), 500);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userId) {
      setError('User ID is required');
      return;
    }

    if (!lookupDone) {
      setError('Please enter a valid User ID first');
      return;
    }

    try {
      await api.payees.create({
        payee_name: name,
        payee_user_id: userId,
        payee_account_id: accountId || undefined,
        nickname: nickname || undefined,
      });
      setShowAdd(false);
      resetForm();
      loadPayees();
    } catch (err: any) { setError(err.message); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      await api.payees.update(editing.id, {
        payee_name: name,
        payee_user_id: userId || null,
        payee_account_id: accountId || null,
        nickname: nickname || null,
      });
      setEditing(null);
      resetForm();
      loadPayees();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payee?')) return;
    try {
      await api.payees.delete(id);
      loadPayees();
    } catch (err: any) { alert(err.message); }
  };

  const openEdit = (p: Payee) => {
    setEditing(p);
    setName(p.payee_name);
    setUserId(p.payee_user_id || '');
    setAccountId(p.payee_account_id || '');
    setNickname(p.nickname || '');
    setError(''); setLookupDone(false); setLookupError('');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const renderLookupStatus = () => {
    if (lookupLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking up user...
        </div>
      );
    }
    if (lookupError) {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {lookupError}
        </div>
      );
    }
    if (lookupDone) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> User found
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payees</h1>
          <p className="text-muted-foreground">Manage your saved payees for quick transfers</p>
        </div>
        <Button onClick={() => { setShowAdd(true); resetForm(); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Payee
        </Button>
      </div>

      {payees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No payees yet</h3>
            <p className="text-muted-foreground mt-1">Add a payee to start sending money</p>
            <Button className="mt-4" onClick={() => { setShowAdd(true); resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" /> Add Your First Payee
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payees.map(p => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{p.payee_name}</h3>
                    {p.nickname && <p className="text-sm text-muted-foreground">{p.nickname}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded">
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {p.payee_user_id && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">User</Badge>
                      <span className="text-xs text-muted-foreground">{p.payee_user_id}</span>
                    </div>
                  )}
                  {p.payee_account_id && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Account</Badge>
                      <span className="text-xs text-muted-foreground">{p.payee_account_id}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Payee Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Payee</DialogTitle>
            <DialogDescription>Enter the payee's User ID to auto-populate their details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>User ID *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="john42@novapay"
                  value={userId}
                  onChange={e => handleUserIdChange(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
              {renderLookupStatus()}
            </div>

            {lookupDone && (
              <div className="rounded-md border bg-muted/50 p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Payee Name</Label>
                  <p className="font-medium">{name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Checking Account</Label>
                  <p className="font-mono text-sm">{accountId || 'N/A'}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nickname <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="e.g. Landlord, Mom" value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={!lookupDone}>Add Payee</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Payee Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payee</DialogTitle>
            <DialogDescription>Update the payee's information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Payee Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input value={userId} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input value={accountId} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
