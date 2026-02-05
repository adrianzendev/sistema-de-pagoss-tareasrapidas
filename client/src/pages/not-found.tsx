import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Página no encontrada</h1>
          <p className="text-muted-foreground mb-6">
            La página que buscas no existe o ha sido movida.
          </p>
          <Link href="/">
            <Button data-testid="button-go-home">
              <Home className="h-4 w-4 mr-2" />
              Ir al inicio
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
