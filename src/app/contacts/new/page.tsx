import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function NewContactRedirect() {
  redirect('/?new=1');
}
