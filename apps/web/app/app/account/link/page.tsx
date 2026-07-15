import { AccountLinkConfirmation } from "../../../../components/account-link-confirmation";

export default async function AccountLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AccountLinkConfirmation token={token ?? ""} />;
}
