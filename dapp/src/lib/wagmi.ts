import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Hush Trading',
  projectId: '8803e4b33d352091f72c2bb7c69b518a',
  chains: [sepolia],
  ssr: true,
}); 