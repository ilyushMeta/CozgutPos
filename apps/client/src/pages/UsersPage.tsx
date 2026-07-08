import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { createUser, listUsers, updateUser, type UserRow } from '../api';
import { DataTable } from '../components/DataTable';
import { useAuthStore } from '../store/auth';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

export function UsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>('CASHIER');
  const [error, setError] = useState<string | null>(null);

  const { data = [] } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const create = useMutation({
    mutationFn: () => createUser({ username, password, role }),
    onSuccess: () => {
      setUsername('');
      setPassword('');
      setRole('CASHIER');
      setError(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => setError(e?.response?.data?.code ?? 'error'),
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserRow) => updateUser(user.id, { isActive: !user.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: any) => setError(e?.response?.data?.code ?? 'error'),
  });

  const columns: ColumnDef<UserRow, any>[] = [
    { header: t('auth.username'), accessorKey: 'username' },
    { header: t('auth.role'), cell: ({ row }) => t(`auth.${row.original.role.toLowerCase()}`) },
    {
      header: t('common.result'),
      cell: ({ row }) => (row.original.isActive ? t('users.active') : t('users.inactive')),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <button
          onClick={() => toggleActive.mutate(row.original)}
          disabled={row.original.id === currentUserId && row.original.isActive}
          className="text-blue-600 hover:underline text-xs disabled:opacity-40 disabled:no-underline"
        >
          {row.original.isActive ? t('users.deactivate') : t('users.activateUser')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('users.title')}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim() && password.trim()) create.mutate();
        }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap items-end gap-2"
      >
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('auth.username')}
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('auth.password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('auth.role')}
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'ADMIN' | 'CASHIER')}
            className={inputCls}
          >
            <option value="CASHIER">{t('auth.cashier')}</option>
            <option value="ADMIN">{t('auth.admin')}</option>
          </select>
        </div>
        <button type="submit" className={primaryBtnCls}>
          {t('users.addNew')}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
