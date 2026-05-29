const MOCK_ADMIN_USERS = [
  {
    name: "Admin ISTURA",
    email: "admin@istura.id",
    role: "Super Admin",
    status: "Aktif",
    lastLogin: "Hari ini",
  },
  {
    name: "Operator Booking",
    email: "operator@istura.id",
    role: "Operator",
    status: "Aktif",
    lastLogin: "Kemarin, 16:24",
  },
  {
    name: "Editor Konten",
    email: "editor@istura.id",
    role: "Editor",
    status: "Nonaktif",
    lastLogin: "12 Mei 2026",
  },
];

export function AdminUsersList() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Pengguna Admin</h1>
          <p>Daftar akun yang memiliki akses dashboard ISTURA.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Peran</th>
              <th>Status</th>
              <th>Login terakhir</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ADMIN_USERS.map((user) => (
              <tr key={user.email}>
                <td>
                  <strong>{user.name}</strong>
                </td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <span className={`admin-pill admin-pill--${user.status === "Aktif" ? "ok" : "off"}`}>
                    {user.status}
                  </span>
                </td>
                <td>{user.lastLogin}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="admin-info-note">
          Tambah akun, ubah peran, dan reset password tersedia setelah backend autentikasi
          terhubung.
        </p>
      </section>
    </div>
  );
}

const MOCK_AUDIT_LOG = [
  {
    actor: "Admin ISTURA",
    action: "Menyetujui booking ISTURA-2026-0042",
    at: "26 Mei 2026, 09.12 WIB",
  },
  {
    actor: "Admin ISTURA",
    action: "Mengubah jawaban FAQ 'Apakah booking harus dilakukan minimal H-5?'",
    at: "25 Mei 2026, 17.04 WIB",
  },
  {
    actor: "Operator Booking",
    action: "Menutup slot 12.00 - 14.00 WIB pada 30 Mei 2026",
    at: "25 Mei 2026, 11.20 WIB",
  },
  {
    actor: "Admin ISTURA",
    action: "Menandai ISTURA-2026-0039 sebagai Completed",
    at: "22 Mei 2026, 12.10 WIB",
  },
];

export function AdminAuditLog() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Riwayat Aktivitas</h1>
          <p>Log perubahan yang dilakukan oleh tim admin.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <ol className="admin-audit-list">
          {MOCK_AUDIT_LOG.map((entry, idx) => (
            <li key={`${entry.actor}-${idx}`}>
              <span className="admin-audit-dot" aria-hidden="true" />
              <div>
                <strong>{entry.actor}</strong>
                <p>{entry.action}</p>
                <small>{entry.at}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className="admin-info-note">
          Log lengkap dengan filter waktu dan ekspor CSV tersedia setelah backend audit
          terhubung.
        </p>
      </section>
    </div>
  );
}
