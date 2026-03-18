import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Wallet, PiggyBank, ArrowLeftRight, Send, History, Edit2, Check, X
} from 'lucide-react';

interface Account {
  id: string;
  account_name: string;
  account_type: string;
  balance: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.accounts.list();
      setAccounts(data.accounts);
      if (data.accounts.length > 0) {
        const txData = await api.accounts.transactions(data.accounts[0].id, 1);
        setRecentTxns(txData.transactions.slice(0, 5));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (accountId: string) => {
    if (!newName.trim()) return;
    try {
      await api.accounts.rename(accountId, newName.trim());
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, account_name: newName.trim() } : a));
      setRenaming(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user?.full_name}</h1>
        <p className="text-muted-foreground">Here's an overview of your accounts</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="sm:col-span-2 md:col-span-1 bg-gradient-to-br from-primary to-blue-700 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
            <p className="text-sm text-blue-200 mt-1">{accounts.length} account(s)</p>
          </CardContent>
        </Card>

        {accounts.map(account => (
          <Card key={account.id} className="relative group">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {account.account_type === 'checking' ? (
                    <Wallet className="h-4 w-4 text-primary" />
                  ) : (
                    <PiggyBank className="h-4 w-4 text-green-600" />
                  )}
                  <CardTitle className="text-sm font-medium">{account.account_name}</CardTitle>
                </div>
                <button
                  onClick={() => { setRenaming(account.id); setNewName(account.account_name); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                >
                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <Badge variant="secondary" className="w-fit text-xs">{account.account_type}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(account.balance)}</p>
              <p className="text-xs text-muted-foreground mt-1">ID: {account.id}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/transfers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 p-6">
              <div className="rounded-full bg-primary/10 p-3">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Send Money</p>
                <p className="text-sm text-muted-foreground">Transfer to payees</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/transfers?tab=internal">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 p-6">
              <div className="rounded-full bg-green-100 p-3">
                <ArrowLeftRight className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Internal Transfer</p>
                <p className="text-sm text-muted-foreground">Move between accounts</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/activity">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 p-6">
              <div className="rounded-full bg-purple-100 p-3">
                <History className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Activity</p>
                <p className="text-sm text-muted-foreground">View transactions</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {recentTxns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTxns.map(tx => (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{tx.description || tx.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(tx.amount)}</p>
                    <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'failed' ? 'destructive' : 'warning'} className="text-xs">
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!renaming} onOpenChange={() => setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Account</DialogTitle>
            <DialogDescription>Enter a new name for this account</DialogDescription>
          </DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Account name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={() => renaming && handleRename(renaming)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
