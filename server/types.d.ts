declare global {
	interface ApplicationConfig {
		http_port: number;
		http_certificates?: { cert: string, key: string, ca?: string };
		tcp_gate: number;
	}
}

export {}