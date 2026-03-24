import { useMemo } from "react";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { decodeJWT, formatJWTTimestamp, isJWTExpired } from "@/lib/jwt";

interface JWTDecoderProps {
  token: string;
  headerName: string;
}

function JsonDisplay({ data, title }: { data: Record<string, unknown>; title: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function ClaimRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/50 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

export function JWTDecoder({ token, headerName }: JWTDecoderProps) {
  const decoded = useMemo(() => decodeJWT(token), [token]);

  if (!decoded) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="w-4 h-4" />
        <span>No JWT token found</span>
      </div>
    );
  }

  if (!decoded.isValid) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>Invalid JWT: {decoded.error}</span>
        </div>
        <div className="bg-muted p-3 rounded-md">
          <p className="text-xs font-mono break-all">{decoded.raw}</p>
        </div>
      </div>
    );
  }

  const isExpired = isJWTExpired(decoded.payload);
  const exp = decoded.payload.exp as number | undefined;
  const iat = decoded.payload.iat as number | undefined;
  const nbf = decoded.payload.nbf as number | undefined;
  const sub = decoded.payload.sub as string | undefined;
  const iss = decoded.payload.iss as string | undefined;
  const aud = decoded.payload.aud as string | string[] | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{headerName}</Badge>
        {isExpired ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Expired
          </Badge>
        ) : (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Valid
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Time Claims
        </h4>
        <div className="bg-muted/50 p-3 rounded-md">
          {iat && <ClaimRow label="Issued At (iat)" value={formatJWTTimestamp(iat)} />}
          {exp && <ClaimRow label="Expires (exp)" value={formatJWTTimestamp(exp)} highlight={isExpired} />}
          {nbf && <ClaimRow label="Not Before (nbf)" value={formatJWTTimestamp(nbf)} />}
        </div>
      </div>

      {(sub || iss || aud) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Standard Claims</h4>
          <div className="bg-muted/50 p-3 rounded-md">
            {sub && <ClaimRow label="Subject (sub)" value={sub} />}
            {iss && <ClaimRow label="Issuer (iss)" value={iss} />}
            {aud && <ClaimRow label="Audience (aud)" value={Array.isArray(aud) ? aud.join(", ") : aud} />}
          </div>
        </div>
      )}

      <JsonDisplay data={decoded.header} title="Header" />
      <JsonDisplay data={decoded.payload} title="Payload" />

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Signature</h4>
        <pre className="bg-muted p-3 rounded-md text-xs font-mono break-all">
          {decoded.signature}
        </pre>
      </div>
    </div>
  );
}
