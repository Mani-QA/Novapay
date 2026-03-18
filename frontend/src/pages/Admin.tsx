import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DollarSign, Users, ShieldAlert, RotateCcw, ScrollText,
  Lock, Unlock, ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react';

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [liquidity, setLiquidity] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersPagination, setUsersPagination] = useState<any>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txPagination, setTxPagination] = useState<any>(null);
  const [txPage, setTxPage] = useState(1);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditPagination, setAuditPagination] = useState<any>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [reverseConfirm, setReverseConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.admin.liquidity().then(setLiquidity).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'users') {
      api.admin.users(usersPage).then(d => { setUsers(d.users); setUsersPagination(d.pagination); });
    }
  }, [tab, usersPage]);

  useEffect(() => {
    if (tab === 'transactions') {
      api.admin.transactions(txPage).then(d => { setTransactions(d.transactions); setTxPagination(d.pagination); });
    }
  }, [tab, txPage]);

  useEffect(() => {
    if (tab === 'audit') {
      api.admin.auditLog(auditPage).then(d => { setAuditLog(d.audit_log); setAuditPagination(d.pagination); });
    }
  }, [tab, auditPage]);

  const handleFreeze = async (userId: string, freeze: boolean) => {
    try {
      await api.admin.freezeUser(userId, freeze);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_frozen: freeze ? 1 : 0 } : u));
    } catch (err: any) { alert(err.message); }
  };

  const handleReverse = async (txId: string) => {
    setLoading(true);
    try {
      await api.admin.reverseTransaction(txId);
      setReverseConfirm(null);
      api.admin.transactions(txPage).then(d => { setTransactions(d.transactions); setTxPagination(d.pagination); });
      api.admin.liquidity().then(setLiquidity);
    } catch (err: any) {
      alert(err.message);
    } finally { setLoading(false); }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: DollarSign },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: RotateCcw },
    { id: 'audit', label: 'Audit Log', icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">System administration and oversight</p>
      </div>

      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && liquidity && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Liquidity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">₹{liquidity.total_liquidity_rupees}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{liquidity.total_accounts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{liquidity.total_users}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-mono text-xs">{u.id}</td>
                      <td className="py-3">{u.full_name}</td>
                      <td className="py-3 text-muted-foreground">{u.email}</td>
                      <td className="py-3"><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge></td>
                      <td className="py-3">
                        {u.is_frozen ? (
                          <Badge variant="destructive">Frozen</Badge>
                        ) : u.locked_until && new Date(u.locked_until) > new Date() ? (
                          <Badge variant="warning">Locked</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {u.role !== 'admin' && (
                          <Button
                            variant={u.is_frozen ? 'outline' : 'destructive'}
                            size="sm"
                            onClick={() => handleFreeze(u.id, !u.is_frozen)}
                          >
                            {u.is_frozen ? <><Unlock className="h-3.5 w-3.5 mr-1" /> Unfreeze</> : <><Lock className="h-3.5 w-3.5 mr-1" /> Freeze</>}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {usersPagination && usersPagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Page {usersPagination.page} of {usersPagination.totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={usersPage >= usersPagination.totalPages} onClick={() => setUsersPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>Reverse completed transactions if needed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">From</th>
                    <th className="pb-3 font-medium">To</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 whitespace-nowrap text-xs">{formatDate(tx.created_at)}</td>
                      <td className="py-3"><Badge variant="outline" className="text-xs">{tx.type.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-3 font-mono text-xs">{tx.from_account_id?.slice(0, 12) || '-'}...</td>
                      <td className="py-3 font-mono text-xs">{tx.to_account_id?.slice(0, 12) || '-'}...</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(tx.amount)}</td>
                      <td className="py-3 text-center">
                        <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'failed' ? 'destructive' : 'warning'} className="text-xs">
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {tx.status === 'completed' && tx.type !== 'reversal' && (
                          <Button variant="outline" size="sm" onClick={() => setReverseConfirm(tx.id)}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reverse
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {txPagination && txPagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Page {txPagination.page} of {txPagination.totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={txPage >= txPagination.totalPages} onClick={() => setTxPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>All sensitive actions recorded in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Entity</th>
                    <th className="pb-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(log => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 whitespace-nowrap text-xs">{formatDate(log.created_at)}</td>
                      <td className="py-3 font-mono text-xs">{log.user_id || '-'}</td>
                      <td className="py-3"><Badge variant="outline">{log.action}</Badge></td>
                      <td className="py-3 text-xs">{log.entity_type ? `${log.entity_type}/${log.entity_id?.slice(0, 10)}...` : '-'}</td>
                      <td className="py-3 text-xs text-muted-foreground max-w-[300px] truncate">{log.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditPagination && auditPagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Page {auditPagination.page} of {auditPagination.totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={auditPage >= auditPagination.totalPages} onClick={() => setAuditPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!reverseConfirm} onOpenChange={() => setReverseConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Reverse Transaction
            </DialogTitle>
            <DialogDescription>
              This action will reverse the transaction and refund the sender. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={loading} onClick={() => reverseConfirm && handleReverse(reverseConfirm)}>
              {loading ? 'Reversing...' : 'Confirm Reversal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
