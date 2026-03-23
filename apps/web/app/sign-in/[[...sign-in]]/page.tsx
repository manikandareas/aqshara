import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main style={authPageStyle}>
      <SignIn />
    </main>
  );
}

const authPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "2rem",
  background: "linear-gradient(135deg, #fff7ed 0%, #e0f2fe 100%)",
};
