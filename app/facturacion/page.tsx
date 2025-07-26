import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import BillingContent from '@/components/billing/BillingContent';

export default async function BillingPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login?redirect=/facturacion');
  }
  
  return <BillingContent user={user} />;
}
