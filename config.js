'use strict';
// Single source of truth: roles, daily sections, form fields, summaries and charts.
// To add/change what a role enters, only edit this file.

const f = (k, label, type = 'text', extra = {}) => ({ k, label, type, ...extra });
const money = (k, label) => f(k, label, 'number', { money: true, min: 0 });


const roles = {
  manager: {
    label: 'Manager',
    sections: [
      {
        id: 'mgr_stats', title: 'Daily calls & appointments', unique: true,
        fields: [
          f('calls', 'Calls received today', 'number', { min: 0, required: true }),
          f('appointments', 'Appointments booked today', 'number', { min: 0, required: true }),
          f('note', 'Note', 'textarea'),
        ],
        summary: [
          { label: 'Calls', field: 'calls', agg: 'sum' },
          { label: 'Appointments', field: 'appointments', agg: 'sum' },
        ],
        chart: {
          title: 'Calls vs appointments (last 30 days)', mode: 'daily', days: 30,
          series: [
            { name: 'Calls', field: 'calls', agg: 'sum' },
            { name: 'Appointments', field: 'appointments', agg: 'sum' },
          ],
        },
      },
      {
        id: 'mgr_tasks', title: 'Work done today (tick) & special note', unique: true,
        fields: [
          f('web_product', 'Website product added', 'checkbox'),
          f('chart_updated', 'Daily chart updated', 'checkbox'),
          f('sales_report', 'Product sale report prepared', 'checkbox'),
          f('complaints_checked', 'Customer complaints reviewed', 'checkbox'),
          f('special_note', 'Special note', 'textarea'),
        ],
      },
      {
        id: 'mgr_web_products', title: 'Website products added',
        fields: [
          f('product', 'Product name', 'text', { required: true }),
          money('price', 'Price (Rs.)'),
          f('note', 'Note'),
        ],
        summary: [{ label: 'Products added', agg: 'count' }],
      },
      {
        id: 'mgr_product_sales', title: 'Sale report of products',
        fields: [
          f('product', 'Product', 'text', { required: true }),
          f('qty', 'Qty', 'number', { min: 0 }),
          money('amount', 'Amount (Rs.)'),
        ],
        summary: [
          { label: 'Items sold', field: 'qty', agg: 'sum' },
          { label: 'Sales (Rs.)', field: 'amount', agg: 'sum', money: true },
        ],
      },
      {
        id: 'mgr_complaints', title: 'Customer complaints',
        fields: [
          f('customer', 'Customer', 'text', { required: true }),
          f('complaint', 'Complaint', 'textarea', { required: true }),
          f('status', 'Status', 'select', { options: ['Open', 'In progress', 'Resolved'] }),
        ],
        summary: [{ label: 'Complaints', agg: 'count' }],
      },
    ],
  },

  marketing: {
    label: 'Marketing Manager',
    sections: [
      {
        id: 'mkt_videos', title: 'Videos made today',
        fields: [
          f('name', 'Video name', 'text', { required: true }),
          f('video_date', 'Video date', 'date', { required: true }),
          f('platform', 'Platform', 'select', { options: ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'WhatsApp', 'Other'] }),
          f('link', 'Link'),
        ],
        summary: [{ label: 'Videos', agg: 'count' }],
        chart: {
          title: 'Videos per day (last 30 days)', mode: 'daily', days: 30,
          series: [{ name: 'Videos', agg: 'count' }],
        },
      },
      {
        id: 'mkt_campaign', title: 'Marketing campaign (daily)',
        fields: [
          f('campaign', 'Campaign', 'text', { required: true }),
          f('platform', 'Platform', 'select', { options: ['Facebook', 'Instagram', 'TikTok', 'Google', 'Leaflet / Offline', 'Other'] }),
          money('spend', 'Spend (Rs.)'),
          f('results', 'Reach / leads', 'number', { min: 0 }),
          f('note', 'Note', 'textarea'),
        ],
        summary: [
          { label: 'Campaigns', agg: 'count' },
          { label: 'Spend (Rs.)', field: 'spend', agg: 'sum', money: true },
        ],
      },
      {
        id: 'mkt_web_products', title: 'Website product update',
        fields: [
          f('product', 'Product', 'text', { required: true }),
          f('action', 'Action', 'select', { options: ['Added', 'Updated', 'Removed'] }),
          f('note', 'Note'),
        ],
        summary: [{ label: 'Updates', agg: 'count' }],
      },
      {
        id: 'mkt_tasks', title: 'Done today (tick) & note', unique: true,
        fields: [
          f('videos_done', 'Daily videos uploaded', 'checkbox'),
          f('campaign_done', 'Campaign running / updated', 'checkbox'),
          f('web_done', 'Website updated', 'checkbox'),
          f('special_note', 'Special note', 'textarea'),
        ],
      },
    ],
  },

  accountant1: {
    label: 'Accountant – Ms. Nadeesha',
    sections: [
      {
        id: 'acc1_check', title: 'Daily check update', unique: true,
        fields: [
          f('cash', 'Cash counted & matched', 'checkbox'),
          f('bank', 'Bank / card payments checked', 'checkbox'),
          f('invoices', 'Invoices / bills checked', 'checkbox'),
          f('note', 'Special note', 'textarea'),
        ],
      },
      {
        id: 'acc1_sales', title: 'Daily sale report',
        fields: [
          f('category', 'Category', 'select', { options: ['Consultation', 'Treatment', 'Pharmacy / Products', 'Lab', 'Other'] }),
          money('amount', 'Amount (Rs.)'),
          f('note', 'Note'),
        ],
        summary: [{ label: 'Sales today (Rs.)', field: 'amount', agg: 'sum', money: true }],
        chart: {
          title: 'Monthly sales – this year vs last 3 years', mode: 'monthly_compare', field: 'amount', years: 4,
        },
      },
      {
        id: 'acc1_patients', title: 'New patient crowd', unique: true,
        fields: [
          f('new_patients', 'New patients today', 'number', { min: 0, required: true }),
          f('total_patients', 'Total patients today', 'number', { min: 0 }),
          f('note', 'Note', 'textarea'),
        ],
        summary: [
          { label: 'New patients', field: 'new_patients', agg: 'sum' },
          { label: 'Total patients', field: 'total_patients', agg: 'sum' },
        ],
        chart: {
          title: 'Patient crowd (last 30 days)', mode: 'daily', days: 30,
          series: [
            { name: 'New patients', field: 'new_patients', agg: 'sum' },
            { name: 'Total patients', field: 'total_patients', agg: 'sum' },
          ],
        },
      },
    ],
  },

  accountant2: {
    label: 'Accountant – Mr. Krishntha',
    sections: [
      {
        id: 'acc2_lectures', title: 'LJ EDUCARE – sir lecture details',
        fields: [
          f('lecturer', 'Sir / Lecturer', 'text', { required: true }),
          f('topic', 'Lecture / Subject'),
          f('students', 'Students', 'number', { min: 0 }),
          f('note', 'Note'),
        ],
        summary: [{ label: 'Lectures', agg: 'count' }, { label: 'Students', field: 'students', agg: 'sum' }],
      },
      {
        id: 'acc2_payments', title: 'LJ EDUCARE – sir payments',
        fields: [
          f('lecturer', 'Sir / Lecturer', 'text', { required: true }),
          money('amount', 'Amount (Rs.)'),
          f('status', 'Status', 'select', { options: ['Paid', 'Pending'] }),
          f('note', 'Note'),
        ],
        summary: [{ label: 'Payments (Rs.)', field: 'amount', agg: 'sum', money: true }],
      },
      {
        id: 'acc2_lj_products', title: 'LJ product daily update',
        fields: [
          f('product', 'Product', 'text', { required: true }),
          f('qty', 'Qty', 'number', { min: 0 }),
          money('amount', 'Amount (Rs.)'),
        ],
        summary: [{ label: 'LJ sales (Rs.)', field: 'amount', agg: 'sum', money: true }],
        chart: {
          title: 'LJ product sales (last 30 days)', mode: 'daily', days: 30,
          series: [{ name: 'Rs.', field: 'amount', agg: 'sum' }],
        },
      },
      {
        id: 'acc2_glorea', title: 'Glorea update',
        fields: [
          f('item', 'Item', 'text', { required: true }),
          f('qty', 'Qty', 'number', { min: 0 }),
          money('amount', 'Amount (Rs.)'),
          f('note', 'Note'),
        ],
        summary: [{ label: 'Glorea (Rs.)', field: 'amount', agg: 'sum', money: true }],
      },
      {
        id: 'acc2_cosmetics', title: 'New cosmetic product sale update',
        fields: [
          f('product', 'Cosmetic product', 'text', { required: true }),
          f('qty', 'Qty', 'number', { min: 0 }),
          money('amount', 'Amount (Rs.)'),
        ],
        summary: [{ label: 'Cosmetic (Rs.)', field: 'amount', agg: 'sum', money: true }],
        chart: {
          title: 'Cosmetic sales (last 30 days)', mode: 'daily', days: 30,
          series: [{ name: 'Rs.', field: 'amount', agg: 'sum' }],
        },
      },
    ],
  },

  receptionist: {
    label: 'Receptionist',
    sections: [
      {
        id: 'rec_customers', title: 'Customers updated today',
        fields: [
          f('customer', 'Customer name', 'text', { required: true }),
          f('phone', 'Phone'),
          f('details', 'Update / details', 'textarea'),
        ],
        summary: [{ label: 'Customers', agg: 'count' }],
        chart: {
          title: 'Customers updated (last 30 days)', mode: 'daily', days: 30,
          series: [{ name: 'Customers', agg: 'count' }],
        },
      },
      {
        id: 'rec_complaints', title: 'Customer complaints',
        fields: [
          f('customer', 'Customer', 'text', { required: true }),
          f('complaint', 'Complaint', 'textarea', { required: true }),
          f('status', 'Status', 'select', { options: ['Open', 'In progress', 'Resolved'] }),
        ],
        summary: [{ label: 'Complaints', agg: 'count' }],
      },
      {
        id: 'rec_sales', title: 'Daily sale report & expenses',
        fields: [
          f('type', 'Type', 'select', { options: ['Sale', 'Expense'], required: true }),
          f('description', 'Description', 'text', { required: true }),
          money('amount', 'Amount (Rs.)'),
        ],
        summary: [
          { label: 'Sales (Rs.)', field: 'amount', agg: 'sum', money: true, where: { field: 'type', equals: 'Sale' } },
          { label: 'Expenses (Rs.)', field: 'amount', agg: 'sum', money: true, where: { field: 'type', equals: 'Expense' } },
        ],
        chart: {
          title: 'Sales vs expenses (last 30 days)', mode: 'daily', days: 30,
          series: [
            { name: 'Sales', field: 'amount', agg: 'sum', where: { field: 'type', equals: 'Sale' } },
            { name: 'Expenses', field: 'amount', agg: 'sum', where: { field: 'type', equals: 'Expense' } },
          ],
        },
      },
    ],
  },

  admin: { label: 'Admin', sections: [] },
};

// Initial accounts created on first run (random passwords are generated and printed once).
const seedUsers = [
  { username: 'admin', name: 'Admin', role: 'admin' },
  { username: 'manager', name: 'Manager', role: 'manager' },
  { username: 'marketing', name: 'Marketing Manager', role: 'marketing' },
  { username: 'nadeesha', name: 'Ms. Nadeesha', role: 'accountant1' },
  { username: 'krishntha', name: 'Mr. Krishntha', role: 'accountant2' },
  { username: 'receptionist', name: 'Receptionist', role: 'receptionist' },
];

const sectionIndex = {};
for (const [roleId, r] of Object.entries(roles)) {
  for (const s of r.sections) sectionIndex[s.id] = { ...s, role: roleId };
}

module.exports = { roles, seedUsers, sectionIndex };
