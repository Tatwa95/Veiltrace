export const SAMPLE_FILE_NAME = 'synthetic-support-export.txt';
export const SAMPLE_CSV_FILE_NAME = 'synthetic-contacts.csv';

/**
 * Synthetic noisy sample containing:
 * - Every required entity type (Email, Phone [IN + Intl], IPv4, IPv6 [standard + compressed], PAN, Aadhaar-like, Luhn-passing Card)
 * - Repeated values for testing Consistent Pseudonymization
 * - Ordinary numeric lookalikes (invoice IDs, timestamps, version numbers, invalid IP-like string)
 * - A 16-digit card-like number that FAILS Luhn (must be rejected)
 *
 * All entries are synthetic.
 */
export const SYNTHETIC_SAMPLE_TEXT = `VeilTrace Synthetic Support Ticket Export (Sample Only)
Ticket Ref: INV-2026-000123456789 | Release: v2.4.1.0 | Logged at 14:35:22 UTC

1. Requester Contact
   Name: Aarav Mehta (Project: Helios-9)
   Primary Email: aarav.mehta@example.org
   Backup Email: AARAV.MEHTA@EXAMPLE.ORG
   Mobile (India): +91 98765 43210
   Alternate Call: 9876543210
   US Desk: +1 (555) 234-5678

2. Tax & Identity Format Examples (Synthetic)
   PAN on file: ABCDE1234F
   Secondary PAN: ABCDE1234F
   Aadhaar-like ref: 2345 6789 0123
   Repeated ref: 2345-6789-0123

3. Network Telemetry
   Gateway IPv4: 192.168.10.24
   Mirror IPv4: 192.168.10.24
   IPv6 Node A: 2001:db8::1
   IPv6 Node B: 2001:0db8:0000:0000:0000:0000:0000:0001
   Loopback: ::1
   Invalid IP lookalike (must ignore): 999.42.10.300 and 10.20.30.40.50

4. Billing Checks
   Card candidate (passes Luhn): 4532 1488 0343 6464
   Repeated card candidate: 4532-1488-0343-6464
   Random 16-digit string (fails Luhn, must ignore): 4532 1488 0343 6469
   Order tracking number (lookalike, must ignore): 1000456789012345
`;

export const SYNTHETIC_SAMPLE_CSV = [
  'ticket_id,contact_name,email,phone,tax_and_id,network_ip,billing_note',
  '"TK-101","Aarav Mehta","aarav.mehta@example.org","+91 98765 43210","PAN: ABCDE1234F | Ref: 2345 6789 0123","192.168.10.24","Card 4532 1488 0343 6464 (Luhn pass)"',
  '"TK-102","Aarav Mehta","AARAV.MEHTA@EXAMPLE.ORG","9876543210","Repeated: ABCDE1234F","2001:db8::1","Note with ""quoted text"", comma, and',
  'newline; invalid card 4532 1488 0343 6469"',
  '"TK-103","Nair, Priya","priya.nair@example.net","+1 (555) 234-5678","Aadhaar-like: 2345-6789-0123","999.42.10.300 (invalid IP)","Order ref 1000456789012345"',
].join('\n');
