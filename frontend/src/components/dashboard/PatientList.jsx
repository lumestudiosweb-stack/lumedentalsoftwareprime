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
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        <button className="flex items-center gap-2 bg-lume-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-lume-700 transition">
          <Plus size={16} /> Add Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lume-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">DOB</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">Loading...</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No patients found</td></tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <Link to={`/patients/${p.id}`} className="font-medium text-gray-900 hover:text-lume-600">
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.date_of_birth}</td>
                  <td className="px-6 py-4">
                    <Link to={`/patients/${p.id}`}><ChevronRight size={16} className="text-gray-400" /></Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
            <span className="text-sm text-gray-500">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
