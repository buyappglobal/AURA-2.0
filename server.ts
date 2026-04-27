import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para parsear JSON
  app.use(express.json());

  // API Key de Resend (Solo en el servidor)
  const resend = new Resend('re_VnQCX3yb_DNY7VaGR6VvthqDZDnRuA4Hp');

  // Ruta para enviar el email de bienvenida
  app.post('/api/send-welcome-email', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'Aura Business <onboarding@resend.dev>',
        to: [email],
        subject: 'Bienvenido a Aura Business - Tus credenciales de acceso',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 40px; border-radius: 20px;">
            <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 20px; text-align: center;">Bienvenido a Aura Business</h1>
            <p style="font-size: 16px; color: #ccc; line-height: 1.5;">Hola,</p>
            <p style="font-size: 16px; color: #ccc; line-height: 1.5;">Se ha creado tu cuenta en la plataforma de Aura Business. Aquí tienes tus credenciales de acceso temporal:</p>
            
            <div style="background-color: #111; padding: 20px; border-radius: 10px; margin: 30px 0;">
              <p style="margin: 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Email</p>
              <p style="margin: 5px 0 15px 0; font-size: 18px; font-weight: bold;">${email}</p>
              
              <p style="margin: 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Contraseña Temporal</p>
              <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold;">${password}</p>
            </div>
            
            <p style="font-size: 16px; color: #ccc; line-height: 1.5;">Puedes acceder a tu panel de administración aquí:</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${req.headers.origin}/admin/login" 
                 style="background-color: #fff; color: #000; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                Acceder al Panel
              </a>
            </div>
            
            <p style="font-size: 12px; color: #444; margin-top: 40px; text-align: center; text-transform: uppercase; letter-spacing: 2px;">Aura Business &copy; 2026</p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend API Error:', JSON.stringify(error, null, 2));
        return res.status(500).json({ 
          error: error.message || 'Error sending email via Resend',
          details: error 
        });
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error('Server Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Configuración de Vite como middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
