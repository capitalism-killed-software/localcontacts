import { notFound, redirect } from 'next/navigation';
import { bookHref } from '@/lib/urls';

export const dynamic = 'force-dynamic';

// Old links keep working: the card now lives on the book at /?id=…
export default async function ContactRedirect(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) notFound();
  redirect(bookHref('', { id, edit: searchParams.edit === '1' }));
}
