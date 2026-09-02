import type { Metadata } from 'next';
import { Cabin, Inter } from 'next/font/google';
import './globals.css';
import { CRMProvider } from '@/lib/crm-context';

const cabin = Cabin({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cabin',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sovereign CRM • CRM Imobiliário Multi-tenant WhatsApp',
  description: 'Plataforma SaaS de CRM Imobiliário Multiempresa integrada ao WhatsApp via Z-API com IA Copiloto e Funis de Conversão',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${cabin.variable} ${inter.variable} h-full antialiased`}>
      <body className="h-full bg-[#F0F3FA] text-slate-800 font-sans selection:bg-[#3742AC] selection:text-white">
        <CRMProvider>
          {children}
        </CRMProvider>
      </body>
    </html>
  );
}
