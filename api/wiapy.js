// Recebe a venda paga da Wiapy e manda notificação no Pushover (som de caixa registradora)
const PREMIUM = ['6af3d57bb7632434c3ffb70f', '6af4b0a1371815cbec6e4505'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  if (req.query.k !== process.env.SECRET) return res.status(401).send('unauthorized');

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const p = body.payment || {};
  if (p.status && p.status !== 'paid') return res.status(200).send('ignorado');

  const kit = PREMIUM.includes(body.checkout && body.checkout.id) ? 'Premium' : 'Básico';
  const liquido = ((p.amount || 0) - (p.fee || 0)) / 100;
  const [int, dec] = liquido.toFixed(2).split('.');
  const valor = 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
  const metodo = p.payment_method === 'pix' ? 'Pix' : p.payment_method === 'credit_card' ? 'Cartão' : 'Boleto';

  const temBump = Array.isArray(body.checkout && body.checkout.orderbump) && body.checkout.orderbump.length > 0;
  const bump = temBump ? ' + Bump' : '';

  // Venda vinda do TikTok (utm_source=tiktok ou ttclid em qualquer campo de origem)
  const { customer, ...semCliente } = body;
  const tiktok = /tiktok|ttclid/i.test(JSON.stringify(semCliente));

  const r = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.PUSHOVER_TOKEN,
      user: process.env.PUSHOVER_USER,
      title: tiktok ? 'TikTok | Venda aprovada!' : 'Venda aprovada!',
      message: `Valor recebido ${valor} ${metodo} | ${kit}${bump}`,
      sound: 'caixa',
    }),
  });
  return res.status(r.ok ? 200 : 502).send(await r.text());
}
