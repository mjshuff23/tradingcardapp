import type { AppProps } from 'next/app';
import { AuthProvider } from '../lib/auth-context';
import { ThemeProvider } from '../lib/theme-context';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}
