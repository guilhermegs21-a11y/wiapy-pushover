// Recebe a venda paga da Wiapy e manda notificação no Pushover (som de caixa registradora)
const PREMIUM = ['6af3d57bb7632434c3ffb70f', '6af4b0a1371815cbec6e4505'];
// Produtos vendidos dentro da área de membros
const AREA_MEMBROS = {
  '6b023e7aba649e6c36d80538': 'Upgrade Premium',
  '6b02360dba649e6c36d6e2bf': '+250 Marca Páginas',
  '6b02360ef6f34fd109a6e4d7': 'Tags de Natal',
  '6b02360e95ecbc27e6900600': '12 Flores do Tempo',
  '6b02360eba649e6c36d6e2ef': 'Pack +450 Moldes',
  '6b02360ef6f34fd109a6e4fd': 'Combo 4 Produtos',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  if (req.query.k !== process.env.SECRET) return res.status(401).send('unauthorized');

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const p = body.payment || {};
  if (p.status && p.status !== 'paid') return res.status(200).send('ignorado');

  const checkoutId = body.checkout && body.checkout.id;
  const areaMembros = AREA_MEMBROS[checkoutId];
  const kit = areaMembros || (PREMIUM.includes(checkoutId) ? 'Premium' : 'Básico');
  const liquido = ((p.amount || 0) - (p.fee || 0)) / 100;
  const [int, dec] = liquido.toFixed(2).split('.');
  const valor = 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
  const metodo = p.payment_method === 'pix' ? 'Pix' : p.payment_method === 'credit_card' ? 'Cartão' : 'Boleto';

  const temBump = Array.isArray(body.checkout && body.checkout.orderbump) && body.checkout.orderbump.length > 0;
  const bump = temBump ? ' + Bump' : '';

  // Venda vinda do TikTok (utm_source=tiktok ou ttclid em qualquer campo de origem)
  const { customer, ...semCliente } = body;
  // Só olha os VALORES preenchidos (não o nome dos campos), pra não marcar venda do Facebook por engano
  let tiktok = false;
  const varre = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v && (/tiktok/i.test(v) || /ttclid/i.test(k))) tiktok = true;
      else if (typeof v === 'object') varre(v);
    }
  };
  varre(semCliente);

  const r = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.PUSHOVER_TOKEN,
      user: process.env.PUSHOVER_USER,
      title: areaMembros ? 'Venda aprovada! | Área de membros' : tiktok ? 'TikTok | Venda aprovada!' : 'Venda aprovada!',
      message: `Valor recebido ${valor} ${metodo} | ${kit}${bump}`,
      sound: 'caixa',
    }),
  });
  return res.status(r.ok ? 200 : 502).send(await r.text());
}
