export const DEPARTMENTS = [
  { id: 'municipal', name: 'Municipal Administration', icon: 'Building2' },
  { id: 'transport', name: 'Road Transport', icon: 'Truck' },
  { id: 'electricity', name: 'Electricity Board', icon: 'Zap' },
  { id: 'water', name: 'Water Works', icon: 'Droplets' },
  { id: 'education', name: 'Education Department', icon: 'GraduationCap' },
  { id: 'health', name: 'Health Department', icon: 'HeartPulse' }
];

export const ISSUE_CATEGORIES = [
  { id: 'pothole', name: 'Pothole', icon: 'AlertCircle' },
  { id: 'garbage', name: 'Garbage/Waste', icon: 'Trash2' },
  { id: 'water', name: 'Water Leakage', icon: 'Droplets' },
  { id: 'electricity', name: 'Power Issue', icon: 'Zap' },
  { id: 'drainage', name: 'Drainage Block', icon: 'Waves' },
  { id: 'street-light', name: 'Street Light', icon: 'Sun' },
  { id: 'other', name: 'Other', icon: 'MoreHorizontal' }
];

export const ISSUE_STATUSES = [
  { id: 'open', name: 'Open', color: 'bg-zinc-100 text-zinc-700' },
  { id: 'in-progress', name: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { id: 'resolved', name: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'closed', name: 'Closed', color: 'bg-red-100 text-red-700' }
];

export const OFFICIAL_CREDENTIALS = [
  { deptId: 'municipal', name: 'Municipal Administration', email: 'municipal@civix.gov.in', pass: 'Muni@2026', role: 'official' },
  { deptId: 'transport', name: 'Road Transport', email: 'transport@civix.gov.in', pass: 'Trans@2026', role: 'official' },
  { deptId: 'electricity', name: 'Electricity Board', email: 'electricity@civix.gov.in', pass: 'Elec@2026', role: 'official' },
  { deptId: 'water', name: 'Water Works', email: 'water@civix.gov.in', pass: 'Water@2026', role: 'official' },
  { deptId: 'education', name: 'Education Department', email: 'education@civix.gov.in', pass: 'Edu@2026', role: 'official' },
  { deptId: 'health', name: 'Health Department', email: 'health@civix.gov.in', pass: 'Health@2026', role: 'official' },
  { deptId: 'admin', name: 'Central Admin Portal', email: 'admin@civix.gov.in', pass: 'Admin@2026', role: 'admin' },
];
