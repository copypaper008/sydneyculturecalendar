import { notFound } from 'next/navigation';
import { getEvents } from '@/lib/supabase';
import InstitutionView from '@/components/InstitutionView';

export const revalidate = 3600;

export async function generateStaticParams() {
  const events = await getEvents();
  const names  = Array.from(new Set(events.map(e => e.institution)));
  return names.map(name => ({ name: encodeURIComponent(name) }));
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const institution = decodeURIComponent(name);
  return {
    title: `${institution} — Sydney Culture Calendar`,
    description: `Exhibitions, events and programs at ${institution}.`,
  };
}

export default async function InstitutionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const institution = decodeURIComponent(name);
  const events      = await getEvents();
  const instEvents  = events.filter(e => e.institution === institution);

  if (instEvents.length === 0) notFound();

  return <InstitutionView institution={institution} events={instEvents} />;
}
