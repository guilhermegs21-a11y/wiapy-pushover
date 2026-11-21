// Recebe a venda paga da Wiapy e manda notificação no Pushover (som de caixa registradora)
const PREMIUM = ['6af3d57bb7632434c3ffb70f', '6af4b0a1371815cbec6e4505'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  if (req.query.k !== process.env.SECRET) return res.status(401).send('unauthorized');

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const p = body.payment || {};
  if (p.status && p.status !== 'paid') return res.status(200).send('ignorado');

  const kit = PREMIUM.includes(body.checkout && body.checkout.id) ? 'KIT PREMIUM' : 'KIT BÁSICO';
  const valor = 'R$ ' + ((p.amount || 0) / 100).toFixed(2).replace('.', ',');
  const metodo = p.payment_method === 'pix' ? 'Pix' : p.payment_method === 'credit_card' ? 'Cartão' : 'Boleto';

  const r = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.PUSHOVER_TOKEN,
      user: process.env.PUSHOVER_USER,
      title: 'Venda aprovada!',
      message: `${valor} · ${kit} · ${metodo}`,
      sound: 'cashregister',
    }),
  });
  return res.status(r.ok ? 200 : 502).send(await r.text());
}
