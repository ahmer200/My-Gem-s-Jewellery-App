import React, { useState } from 'react';
import { ShieldCheck, UserCheck, UserPlus } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { ALL_PERMISSIONS } from '../utils/seedData';
import { PermissionKey, UserRole } from '../types/business';
import { DeleteActionButton } from '../components/DeleteActionButton';

export const UsersView: React.FC = () => {
  const {
    staff,
    activeOperator,
    switchOperator,
    addStaffAccount,
    updateStaffAccount,
    deleteStaffAccount,
    hasPermission,
  } = useBusiness();

  const canManage = hasPermission('manage_users');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [selectedPerms, setSelectedPerms] = useState<PermissionKey[]>([
    'view_inventory',
    'create_sales',
    'send_reminders',
  ]);

  const togglePerm = (perm: PermissionKey) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addStaffAccount({
      name: name.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@nagems.pk`,
      pin: pin.trim() || '0000',
      role,
      active: true,
      permissions: role === 'admin' ? ALL_PERMISSIONS.map((p) => p.key) : selectedPerms,
    });
    setName('');
    setEmail('');
    setPin('');
  };

  const toggleExistingPerm = (userId: string, currentPerms: PermissionKey[], perm: PermissionKey) => {
    const next = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];
    updateStaffAccount(userId, { permissions: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Multi-User Access & Role Permissions
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Active Operator: <strong className="text-emerald-700 dark:text-emerald-400">{activeOperator.name}</strong> ({activeOperator.role.toUpperCase()})
        </p>
      </div>

      {/* Create New User Account */}
      {canManage && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <UserPlus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Create Staff / Admin Account
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Usman Tariq"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email / Username
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@nagems.pk"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Counter Quick PIN
              </label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-semibold"
              >
                <option value="staff">Staff (Custom Permissions)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>
          </div>

          {role === 'staff' && (
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                Assign Module Permissions:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(perm.key)}
                      onChange={() => togglePerm(perm.key)}
                      className="rounded border-slate-300 text-emerald-700"
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Create Account
            </button>
          </div>
        </form>
      )}

      {/* Existing Accounts & Quick Operator Switch */}
      <div className="space-y-4">
        {staff.map((user) => {
          const isCurrent = user.id === activeOperator.id;
          return (
            <div
              key={user.id}
              className={`rounded-xl bg-white dark:bg-slate-900 border p-5 space-y-4 text-xs ${
                isCurrent
                  ? 'border-emerald-600 dark:border-emerald-500'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center font-display font-bold text-emerald-800 dark:text-emerald-300">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        {user.name}
                      </span>
                      <span className="font-mono text-slate-500">
                        · {user.role.toUpperCase()} · {user.active ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                    <p className="text-slate-500">{user.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isCurrent ? (
                    <button
                      onClick={() => switchOperator(user.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-emerald-700 px-3.5 py-2 font-semibold text-white hover:bg-slate-800 min-h-[38px]"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Switch to User
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      Active Session
                    </span>
                  )}

                  {canManage && staff.length > 1 && (
                    <>
                      <button
                        onClick={() => updateStaffAccount(user.id, { active: !user.active })}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium"
                      >
                        {user.active ? 'Suspend' : 'Activate'}
                      </button>
                      <DeleteActionButton
                        onConfirm={() => deleteStaffAccount(user.id)}
                        title={`Delete user ${user.name}`}
                      />
                    </>
                  )}
                </div>
              </div>

              {user.role === 'staff' && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <p className="font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Permissions ({user.permissions.length}/{ALL_PERMISSIONS.length}):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {ALL_PERMISSIONS.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2 text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          disabled={!canManage}
                          checked={user.permissions.includes(perm.key)}
                          onChange={() =>
                            toggleExistingPerm(user.id, user.permissions, perm.key)
                          }
                          className="rounded border-slate-300 text-emerald-700"
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
