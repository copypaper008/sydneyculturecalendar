import { notFound } from 'next/navigation';
import { getEvents } from '@/lib/supabase';
import { toInstitutionSlug } from '@/lib/utils';
import InstitutionView from '@/components/InstitutionView';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name: slug } = await params;
  const events = await getEvents();
  const institution = events.find(e => toInstitutionSlug(e.institution) === slug)?.institution ?? slug;
  return {
    title: `${institution} — Sydney Culture Calendar`,
    description: `Exhibitions, events and programs at ${institution}.`,
  };
}

export default async function InstitutionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: slug } = await params;
  const events     = await getEvents();
  const instEvents = events.filter(e => toInstitutionSlug(e.institution) === slug);

  if (instEvents.length === 0) notFound();

  const institution = instEvents[0].institution;
  return <InstitutionView institution={institution} events={instEvents} />;
}
