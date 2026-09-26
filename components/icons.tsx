import {
  Landmark,
  Coins,
  CandlestickChart,
  Scale,
  Shield,
  Server,
  FileCheck2,
  Wallet,
} from 'lucide-react';
import type { IconKey } from '@/lib/types';

const MAP = {
  treasury: Landmark,
  token: Coins,
  trading: CandlestickChart,
  governance: Scale,
  shield: Shield,
  server: Server,
  audit: FileCheck2,
  wallet: Wallet,
} as const;

export function Icon({ name, size = 16 }: { name: IconKey; size?: number }) {
  const Cmp = MAP[name];
  return <Cmp size={size} />;
}
