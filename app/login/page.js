import LoginForm from "./LoginForm";

// Server component wrapper purely so we can safely await searchParams
// (Next 16 makes it a promise) before handing a plain string down to the
// client form -- avoids assuming how searchParams gets passed across the
// client boundary.
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <LoginForm initialError={params?.error || null} />;
}
