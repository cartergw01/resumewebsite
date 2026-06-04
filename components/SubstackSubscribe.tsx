"use client";

import { useState, useId } from "react";

export function SubstackSubscribe() {
  const id = useId();
  const [email, setEmail]       = useState("");
  const [status, setStatus]     = useState<"idle" | "sent">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    window.open(
      `https://carterko.substack.com/subscribe?email=${encodeURIComponent(trimmed)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setStatus("sent");
  };

  return (
    <div className="substack-subscribe">
      <div className="substack-inner">
        <div className="substack-copy">
          <p className="substack-name">flying Arrows</p>
          <p className="substack-desc">
            Essays on tech, culture, and human nature — delivered to your inbox.
          </p>
        </div>

        {status === "sent" ? (
          <p className="substack-thanks">
            Substack opened in a new tab — confirm your email there to subscribe. ✦
          </p>
        ) : (
          <form className="substack-form" onSubmit={handleSubmit} noValidate>
            <label className="sr-only" htmlFor={id}>
              Email address
            </label>
            <input
              id={id}
              className="substack-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
            <button className="substack-btn" type="submit">
              Subscribe
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
