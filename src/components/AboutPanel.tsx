import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import Logo from "./Logo";

export default function AboutPanel() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardContent className="p-6 flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-foreground text-background flex items-center justify-center">
            <Logo size={28} />
          </div>
          <div>
            <div className="text-xl font-semibold">EchoWise</div>
            <div className="text-sm text-muted-foreground">Just talk.</div>
            <div className="text-xs text-muted-foreground mt-1">Version 0.1.0</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What is EchoWise?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            An AI companion that helps you build real English communication ability —
            through daily conversations, not lessons or tests.
          </p>
          <p>
            Open source. Your data stays on your device. Bring your own API key.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Source code"  value="github.com/hujiulin/EchoWise" />
          <Row label="Issues"       value="github.com/hujiulin/EchoWise/issues" />
          <Row label="License"      value="MIT" />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
