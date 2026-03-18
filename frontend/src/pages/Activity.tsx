import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Activity() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.accounts.list().then(data => {
      setAccounts(data.accounts);
      if (data.accounts.length > 0) {
        setSelectedAccount(data.accounts[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    setLoading(true);
    api.accounts.transactions(selectedAccount, page)
      .then(data => {
        setTransactions(data.transactions);
        setPagination(data.pagination);
      })
      .finally(() => setLoading(false));
  }, [selectedAccount, page]);

  const handleDownload = async () => {
    try {
      const text = await api.accounts.statement(selectedAccount);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${selectedAccount}-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusVariant = (s: string) => {
    if (s === 'completed') return 'success' as const;
    if (s === 'failed') return 'destructive' as const;
    return 'warning' as const;
  };

  const currentAccount = accounts.find(a => a.id === selectedAccount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Activity</h1>
          <p className="text-muted-foreground">View transaction history and download statements</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedAccount}
            onChange={e => { setSelectedAccount(e.target.value); setPage(1); }}
            className="w-64"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.account_name} ({formatCurrency(a.balance)})
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={handleDownload} disabled={!selectedAccount}>
            <Download className="h-4 w-4 mr-2" /> Statement
          </Button>
        </div>
      </div>

      {currentAccount && (
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-200">{currentAccount.account_name}</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(currentAccount.balance)}</p>
              </div>
              <Badge className="bg-white/20 text-white border-0">{currentAccount.account_type}</Badge>
            </div>
            <p className="text-xs text-blue-200 mt-2">Account ID: {currentAccount.id}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transactions</CardTitle>
          {pagination && (
            <CardDescription>{pagination.total} total transaction(s)</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found for this account</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 font-medium text-right">Amount</th>
                      <th className="pb-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => {
                      const isDebit = tx.from_account_id === selectedAccount;
                      return (
                        <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-xs">
                              {tx.type.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 text-muted-foreground max-w-[200px] truncate">
                            {tx.description || '-'}
                          </td>
                          <td className={`py-3 text-right font-medium ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                            {isDebit ? '-' : '+'}{formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 text-center">
                            <Badge variant={statusVariant(tx.status)} className="text-xs">
                              {tx.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
