// Recebe a venda paga da LOWIFY e manda notificação no Pushover (som de caixa registradora).
// Arquivo novo e separado: o aviso da Wiapy (api/wiapy.js) continua igual.
// Mesmo formato do aviso da Wiapy: "Calendários | Venda aprovada!" / "Bordados | Venda aprovada!".

const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function classifica(nome) {
  const n = tira(nome);
  const bordados = n.includes('bordapapel');
  const produto = bordados ? 'Bordados' : 'Calendários';
  if (n.includes('(bump')) return { produto, kit: null, bump: true };
  const area = n.includes('area de membros') || n.includes('area bordapapel') || n.includes('upgrade');
  let kit;
  if (n.includes('upgrade')) kit = bordados ? 'Upgrade Completo' : 'Upgrade Premium';
  else if (n.includes('12 flores')) kit = '12 Flores do Tempo';
  else if (n.includes('marca paginas')) kit = '+250 Marca Páginas';
  else if (n.includes('tags de natal')) kit = 'Tags de Natal';
  else if (n.includes('moldes de caixas')) kit = 'Pack +450 Moldes';
  else if (n.includes('combo 4')) kit = 'Combo 4 Produtos';
  else if (bordados && n.includes('kit premium')) kit = 'Kit Premium Calendários';
  else if (n.includes('completo')) kit = 'Completo';
  else if (n.includes('premium')) kit = 'Premium';
  else if (n.includes('basico')) kit = 'Básico';
  else kit = String(nome || 'Produto').slice(0, 60);
  const areaMembros = area || ['+250 Marca Páginas', 'Pack +450 Moldes', 'Combo 4 Produtos'].includes(kit);
  return { produto, kit, bump: false, areaMembros };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  if (!process.env.LOWIFY_SECRET || req.query.k !== process.env.LOWIFY_SECRET) return res.status(401).send('unauthorized');

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).send('corpo invalido'); }
  }
  const status = tira(body.status || body.event);
  if (!status.includes('paid')) return res.status(200).send('ignorado');

  const prod = body.product || {};
  const tipo = tira(prod.type);
  const c = classifica(prod.name);
  // Order bump chega como item à parte: não toca de novo, a venda principal já avisou.
  if (c.bump || tipo.includes('bump')) return res.status(200).send('bump ignorado');

  // sale_amount já é o que o produtor recebe: a taxa de R$ 0,99 da Lowify é
  // cobrada da cliente, por cima do preço (9,90 pago = 8,91 + 0,99).
  const liquido = Math.max(0, Number(body.sale_amount ?? prod.price ?? 0) || 0);
  const [int, dec] = liquido.toFixed(2).split('.');
  const valor = 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
  const pm = tira(body.payment_method || (body.payment && body.payment.method));
  const metodo = pm.includes('pix') ? ' Pix' : pm.includes('card') || pm.includes('cartao') ? ' Cartão' : pm.includes('boleto') ? ' Boleto' : '';

  // Venda do TikTok: utm_source=tiktok ou ttclid
  const t = body.tracking || {};
  const tiktok = Object.entries(t).some(([k, v]) => typeof v === 'string' && v && (/tiktok/i.test(v) || /ttclid/i.test(k)));

  const titulo =
    (body.test ? 'TESTE | ' : '') +
    c.produto + ' | ' +
    (c.areaMembros ? 'Venda aprovada! | Área de membros' : tiktok ? 'TikTok | Venda aprovada!' : 'Venda aprovada!');

  const r = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.PUSHOVER_TOKEN,
      user: process.env.PUSHOVER_USER,
      title: titulo,
      message: `Valor recebido ${valor}${metodo} | ${c.kit} | Lowify`,
      sound: 'caixa',
    }),
  });
  return res.status(r.ok ? 200 : 502).send(await r.text());
}
