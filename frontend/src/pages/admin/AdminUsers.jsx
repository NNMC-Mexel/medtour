import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  X,
  UserPlus,
  Pencil,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import api, { getMediaUrl } from '../../services/api'
import { formatDate } from '../../utils/helpers'

const roleVariants = {
  patient: 'default',
  doctor: 'primary',
  admin: 'danger',
  manager: 'warning',
}

const defaultCreateForm = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  userRole: 'admin',
}

const defaultEditForm = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

function AdminUsers() {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const roleLabels = {
    patient: t('admin_users.role_patient'),
    doctor: t('admin_users.role_doctor'),
    admin: t('admin_users.role_admin'),
    manager: t('admin_users.role_manager'),
  }

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState(defaultCreateForm)
  const [isCreating, setIsCreating] = useState(false)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState(defaultEditForm)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/users?populate=*&pagination[limit]=1000')
      setUsers(response.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    if (roleFilter !== 'all' && user.userRole !== roleFilter) {
      return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setIsDeleting(true)
    try {
      await api.delete(`/api/users/${selectedUser.id}`)
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id))
      setShowDeleteModal(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error deleting user:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateStaff = async (e) => {
    e.preventDefault()
    if (!createForm.fullName.trim()) return alert(t('admin_users.err_name'))
    if (!createForm.username.trim()) return alert(t('admin_users.err_login'))
    if (!createForm.email.trim()) return alert(t('admin_users.err_email'))
    if (!createForm.password) return alert(t('admin_users.err_password'))
    if (createForm.password.length < 6) return alert(t('admin_users.err_short_password'))
    if (createForm.password !== createForm.confirmPassword) return alert(t('admin_users.err_password_mismatch'))

    setIsCreating(true)
    try {
      let roleId = null
      try {
        const rolesRes = await api.get('/api/users-permissions/roles')
        const roleList = rolesRes?.data?.roles || rolesRes?.data || []
        roleId =
          roleList.find((r) => r?.type === createForm.userRole)?.id ||
          roleList.find((r) => String(r?.name || '').toLowerCase() === createForm.userRole)?.id ||
          roleList.find((r) => r?.type === 'authenticated')?.id ||
          null
      } catch {
        /* ignore */
      }

      const payload = {
        username: createForm.username.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        confirmed: true,
        blocked: false,
        userRole: createForm.userRole,
        fullName: createForm.fullName.trim(),
      }
      if (roleId) payload.role = roleId

      await api.post('/api/users', payload)
      setIsCreateModalOpen(false)
      setCreateForm(defaultCreateForm)
      await fetchUsers()
    } catch (error) {
      const message = error?.response?.data?.error?.message || error?.message || t('admin_users.err_save')
      alert(t('admin_users.err_save_msg', { message }))
    } finally {
      setIsCreating(false)
    }
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setEditForm({
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      confirmPassword: '',
    })
    setIsEditModalOpen(true)
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    if (!editForm.fullName.trim()) return alert(t('admin_users.err_name'))
    if (!editForm.username.trim()) return alert(t('admin_users.err_login'))
    if (!editForm.email.trim()) return alert(t('admin_users.err_email'))
    if (editForm.password && editForm.password.length < 6) return alert(t('admin_users.err_short_password'))
    if (editForm.password !== editForm.confirmPassword) return alert(t('admin_users.err_password_mismatch'))

    setIsSavingEdit(true)
    try {
      const payload = {
        fullName: editForm.fullName.trim(),
        username: editForm.username.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim() || null,
      }
      if (editForm.password) {
        payload.password = editForm.password
      }

      await api.put(`/api/users/${editingUser.id}`, payload)
      setUsers(prev => prev.map(u =>
        u.id === editingUser.id
          ? { ...u, fullName: payload.fullName, username: payload.username, email: payload.email, phone: payload.phone }
          : u
      ))
      setIsEditModalOpen(false)
      setEditingUser(null)
      setEditForm(defaultEditForm)
    } catch (error) {
      const message = error?.response?.data?.error?.message || error?.message || t('admin_users.err_save')
      alert(t('admin_users.err_save_msg', { message }))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleBlockUser = async (userId, blocked) => {
    try {
      await api.put(`/api/users/${userId}`, { blocked })
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, blocked } : u
      ))
    } catch (error) {
      console.error('Error blocking user:', error)
    }
  }

  const openDeleteModal = (user) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin_users.title')}</h1>
          <p className="text-slate-600">{t('admin_users.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => { setCreateForm({ ...defaultCreateForm, userRole: 'admin' }); setIsCreateModalOpen(true) }}
          >
            {t('admin_users.add_admin_btn')}
          </Button>
          <Button
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => { setCreateForm({ ...defaultCreateForm, userRole: 'manager' }); setIsCreateModalOpen(true) }}
          >
            {t('admin_users.add_manager_btn')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t('admin_users.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: t('admin_users.filter_all') },
            { value: 'patient', label: t('admin_users.filter_patient') },
            { value: 'doctor', label: t('admin_users.filter_doctor') },
            { value: 'admin', label: t('admin_users.filter_admin') },
            { value: 'manager', label: t('admin_users.filter_manager') },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRoleFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                roleFilter === value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_user')}</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">Email</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_role')}</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_status')}</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_registered')}</th>
                  <th className="text-right py-4 px-6 font-medium text-slate-500">{t('admin_users.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      {t('admin_users.no_users')}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={getMediaUrl(user.avatar)}
                            name={user.fullName || user.username}
                            size="md"
                          />
                          <div>
                            <p className="font-medium text-slate-900">
                              {user.fullName || user.username}
                            </p>
                            <p className="text-sm text-slate-500">
                              {user.phone || t('admin_users.no_phone')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">{user.email}</td>
                      <td className="py-4 px-6">
                        <Badge variant={roleVariants[user.userRole] || 'default'}>
                          {roleLabels[user.userRole] || user.userRole}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        {user.blocked ? (
                          <Badge variant="danger">{t('admin_users.blocked')}</Badge>
                        ) : user.confirmed ? (
                          <Badge variant="success">{t('admin_users.active')}</Badge>
                        ) : (
                          <Badge variant="default">{t('admin_users.not_confirmed')}</Badge>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => openEditModal(user)}
                            aria-label={t('admin_users.edit_aria')}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {user.blocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleBlockUser(user.id, false)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {t('admin_users.unblock')}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleBlockUser(user.id, true)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              {t('admin_users.block')}
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => openDeleteModal(user)}
                            aria-label={t('admin_users.delete_aria')}
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {users.filter(u => u.userRole === 'patient').length}
            </p>
            <p className="text-slate-500">{t('admin_users.stat_patients')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {users.filter(u => u.userRole === 'doctor').length}
            </p>
            <p className="text-slate-500">{t('admin_users.stat_doctors')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {users.filter(u => u.userRole === 'admin' || u.userRole === 'manager').length}
            </p>
            <p className="text-slate-500">{t('admin_users.stat_staff')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {users.filter(u => u.blocked).length}
            </p>
            <p className="text-slate-500">{t('admin_users.stat_blocked')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingUser(null); setEditForm(defaultEditForm) }}
        title={t('admin_users.edit_title')}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setIsEditModalOpen(false); setEditingUser(null); setEditForm(defaultEditForm) }}
              disabled={isSavingEdit}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditUser} isLoading={isSavingEdit}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          {editingUser && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-sm text-slate-500">{t('admin_users.label_role')}:</span>
              <Badge variant={roleVariants[editingUser.userRole] || 'default'}>
                {roleLabels[editingUser.userRole] || editingUser.userRole}
              </Badge>
            </div>
          )}

          <Input
            label={t('admin_users.label_name')}
            required
            value={editForm.fullName}
            onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
            placeholder={t('admin_users.placeholder_name')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('admin_users.label_login')}
              required
              value={editForm.username}
              onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder={t('admin_users.placeholder_login')}
            />
            <Input
              label="Email"
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="user@example.com"
            />
          </div>

          <Input
            label={t('admin_users.label_phone')}
            type="tel"
            value={editForm.phone}
            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+7 700 000 0000"
          />

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-3">{t('admin_users.section_password')}</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('admin_users.label_new_password')}
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••"
                hint={t('admin_users.hint_password')}
              />
              <Input
                label={t('admin_users.label_confirm')}
                type="password"
                value={editForm.confirmPassword}
                onChange={(e) => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="••••••"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Create Staff Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setCreateForm(defaultCreateForm) }}
        title={createForm.userRole === 'manager' ? t('admin_users.create_manager_title') : t('admin_users.create_admin_title')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setIsCreateModalOpen(false); setCreateForm(defaultCreateForm) }} disabled={isCreating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateStaff} isLoading={isCreating}>
              {t('admin_users.create_btn')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-sm text-slate-500">{t('admin_users.label_role')}:</span>
            <Badge variant={createForm.userRole === 'manager' ? 'warning' : 'danger'}>
              {roleLabels[createForm.userRole]}
            </Badge>
          </div>
          <Input
            label={t('admin_users.label_name')}
            required
            value={createForm.fullName}
            onChange={(e) => setCreateForm(prev => ({ ...prev, fullName: e.target.value }))}
            placeholder={t('admin_users.placeholder_name')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('admin_users.label_login')}
              required
              value={createForm.username}
              onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder={t('admin_users.placeholder_login')}
            />
            <Input
              label="Email"
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="admin@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('admin_users.label_password')}
              type="password"
              required
              value={createForm.password}
              onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
              placeholder="••••••"
            />
            <Input
              label={t('admin_users.label_confirm')}
              type="password"
              required
              value={createForm.confirmPassword}
              onChange={(e) => setCreateForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="••••••"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('admin_users.delete_title')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              isLoading={isDeleting}
            >
              {t('documents.delete_action')}
            </Button>
          </>
        }
      >
        <div className="text-center py-4">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-4" />
          <p className="text-slate-600">
            {t('appointments.cancel_question')}{' '}
            <span className="font-semibold">{selectedUser?.fullName || selectedUser?.username}</span>?
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {t('documents.delete_desc')}
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default AdminUsers
