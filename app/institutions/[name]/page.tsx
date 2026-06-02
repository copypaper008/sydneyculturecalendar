import { notFound } from 'next/navigation';
import { getEvents } from '@/lib/supabase';
import InstitutionView from '@/components/InstitutionView';

export const revalidate = 3600;

// dynamicParams defaults to true — paths not pre-generated are rendered on demand
export const dynamicParams = true;

export async function generateStaticParams() {
  const events = await getEvents();
  const names  = Array.from(new Set(events.map(e => e.institution)));
  // Return raw names — Next.js handles URL encoding; do NOT encodeURIComponent here
  return names.map(name => ({ name }));
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return {
    title: `${name} — Sydney Culture Calendar`,
    description: `Exhibitions, events and programs at ${name}.`,
  };
}

export default async function InstitutionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: institution } = await params;
  const events     = await getEvents();
  const instEvents = events.filter(e => e.institution === institution);

  if (instEvents.length === 0) notFound();

  return <InstitutionView institution={institution} events={instEvents} />;
}
