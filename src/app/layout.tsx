import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CRMProvider } from '@/lib/crm-context';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Vanguard CRM • CRM Imobiliário Multi-tenant WhatsApp',
  description: 'Plataforma SaaS de CRM Imobiliário Multiempresa integrada ao WhatsApp via Z-API com IA Copiloto e Funis de Conversão',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
        <CRMProvider>
          {children}
        </CRMProvider>
      </body>
    </html>
  );
}
