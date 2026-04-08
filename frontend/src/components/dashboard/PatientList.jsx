import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { patientAPI } from '../../services/mockApi';
import { Search, Plus, ChevronRight } from 'lucide-react';

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await patientAPI.list({ limit, offset: page * limit, search: search || undefined });
        setPatients(data.patients);
        setTotal(data.total);
      } catch {
        setPatients([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search, page]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-white">Patients</h1>
        <button className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">
          <Plus size={16} /> Add Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-lume-500/50 focus:border-lume-500/50 outline-none placeholder-gray-600"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-2 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">DOB</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-600">Loading...</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-600">No patients found</td></tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="px-6 py-4">
                    <Link to={`/patients/${p.id}`} className="font-medium text-white hover:text-lume-400 transition">
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.date_of_birth}</td>
                  <td className="px-6 py-4">
                    <Link to={`/patients/${p.id}`}><ChevronRight size={16} className="text-gray-600" /></Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {total > limit && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5">
            <span className="text-sm text-gray-500">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-sm border border-white/10 rounded text-gray-400 disabled:opacity-30 hover:bg-white/5 transition">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * limit >= total} className="px-3 py-1 text-sm border border-white/10 rounded text-gray-400 disabled:opacity-30 hover:bg-white/5 transition">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
