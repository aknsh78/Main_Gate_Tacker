const STORAGE_KEYS = {
  USER: "mgt_logged_in_user",
  VISITORS: "mgt_visitor_records"
};

// Starter sample data so the dashboard isn't empty on first load
const DEFAULT_VISITORS = [
  {
    id: 101,
    name: "Rohan Sharma",
    phone: "9876543210",
    purpose: "Admission Inquiry",
    checkIn: "09:30 AM",
    checkOut: null,
    status: "Inside"
  },
  {
    id: 102,
    name: "Priya Verma",
    phone: "9123456780",
    purpose: "Parent Visit",
    checkIn: "10:15 AM",
    checkOut: "11:40 AM",
    status: "Checked Out"
  },
  {
    id: 103,
    name: "Amit Kumar",
    phone: "9988776655",
    purpose: "Vendor / Delivery",
    checkIn: "11:05 AM",
    checkOut: null,
    status: "Inside"
  }
];

function getVisitors() {
  const saved = localStorage.getItem(STORAGE_KEYS.VISITORS);
  if (!saved) {
    localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(DEFAULT_VISITORS));
    return DEFAULT_VISITORS;
  }
  return JSON.parse(saved);
}

function saveVisitors(list) {
  localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(list));
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}