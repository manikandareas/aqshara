import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main style={authPageStyle}>
      <SignUp />
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
