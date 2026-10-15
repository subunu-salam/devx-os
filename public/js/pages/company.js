import { icon } from '../api.js';
import { pageHead } from '../ui.js';

const SERVICES = [
  ['cpu', 'Business Growth Through AI', 'Deploying AI to impact sales, operations, customer experience, and decision-making.'],
  ['zap', 'Operational Automation', 'Eliminating manual tasks and connecting disconnected tools.'],
  ['leads', 'Customer Experience Systems', 'Digital journeys optimized around real customer behavior.'],
  ['layers', 'Business Process Platforms', 'Custom systems connecting teams, departments, and workflows.'],
  ['report', 'Data & Decision Intelligence', 'Turning business data into dashboards and AI-driven insight.'],
  ['building', 'Digital Product Development', 'End-to-end builds: platforms, apps, websites, ERPs, e-commerce.'],
];
const STATS = [['50+', 'Projects Delivered'], ['30+', 'Happy Clients'], ['15+', 'Tech Experts'], ['6+', 'Industries'], ['100%', 'Client Satisfaction']];
const LINKS = [
  ['external', 'Website', 'https://www.devxpert.ae'],
  ['leads', 'LinkedIn', 'https://www.linkedin.com/company/devx-technologies/'],
  ['target', 'Instagram', 'https://instagram.com/devx_tech.ae'],
  ['zap', 'X (Twitter)', 'https://x.com/DevX_UAE'],
];

export default async function company(view) {
  view.innerHTML = pageHead({ title: 'Company', desc: 'DevX Technologies LLC — internal reference.' }) + `
    <div class="hero mb16">
      <img src="/assets/devx-logo-dark.png" alt="DevX Technologies">
      <div style="flex:1;min-width:220px">
        <h1>DevX Technologies LLC</h1>
        <div class="tag">Building Beyond Next — AI-Led Business Improvement</div>
        <p style="color:rgba(255,255,255,.7);margin:10px 0 0;max-width:640px">A business-first software & AI company based in Dubai. “We don’t start by selling software. We start by understanding your business.”</p>
      </div>
    </div>

    <div class="stat-strip mb16">${STATS.map(([n, l]) => `<div class="card"><div class="card-pad"><div class="n">${n}</div><div class="l">${l}</div></div></div>`).join('')}</div>

    <h3 style="margin:8px 0 12px">What we do</h3>
    <div class="svc mb16">${SERVICES.map(([ic, t, d]) => `<div class="card"><div class="card-pad"><div class="ic">${icon(ic)}</div><strong>${t}</strong><p class="muted" style="margin:6px 0 0">${d}</p></div></div>`).join('')}</div>

    <div class="grid cols-2">
      <div class="card"><div class="card-head"><h3>Featured product — DevX Nexus</h3></div>
        <div class="card-pad"><p class="muted">An AI-powered retail operating system: conversational product discovery, smart in-store navigation, QR-based checkout, and a live-sync admin platform. Currently deployed in production.</p></div></div>
      <div class="card"><div class="card-head"><h3>Contact</h3></div>
        <div class="card-pad">
          <div class="detail-row"><span class="k">${icon('phone')} Phone / WhatsApp</span><strong>+971 54 749 7336</strong></div>
          <div class="detail-row"><span class="k">${icon('mail')} Email</span><strong>hello@devxpert.ae</strong></div>
          <div class="detail-row"><span class="k">${icon('pin')} Address</span><strong>Dubai Investment Park 1, Dubai, UAE</strong></div>
          <div class="detail-row"><span class="k">${icon('clock')} Hours</span><strong>Mon–Fri · 9:00–18:00 GST</strong></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            ${LINKS.map(([ic, l, u]) => `<a class="btn btn-outline btn-sm" href="${u}" target="_blank" rel="noopener">${icon(ic)} ${l}</a>`).join('')}
          </div>
        </div></div>
    </div>`;
}
