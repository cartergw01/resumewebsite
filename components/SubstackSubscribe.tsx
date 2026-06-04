"use client";

import Image from "next/image";
import { useState, useId } from "react";

const LOGO =
  "https://substackcdn.com/image/fetch/w_256,c_limit,f_auto,q_auto:best,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F7917be9a-8ed4-4519-ac5a-3145313d9419_1024x1024.png";

export function SubstackSubscribe() {
  const id = useId();
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");

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
    <div className="fa-subscribe">
      {/* fire glow backdrop */}
      <div className="fa-glow" aria-hidden="true" />

      <div className="fa-card">
        <Image
          className="fa-logo"
          src={LOGO}
          alt="flying Arrows"
          width={88}
          height={88}
          quality={90}
        />

        <div className="fa-body">
          <p className="fa-name">flying Arrows</p>
          <p className="fa-tagline">essays on tech, culture, and human nature.</p>

          {status === "sent" ? (
            <p className="fa-thanks">
              Check Substack — confirm your email there to subscribe. ✦
            </p>
          ) : (
            <>
              <p className="fa-cta">Subscribe to keep up to date on new essays.</p>
              <form className="fa-form" onSubmit={handleSubmit} noValidate>
                <label className="sr-only" htmlFor={id}>Email address</label>
                <input
                  id={id}
                  className="fa-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  inputMode="email"
                />
                <button className="fa-btn" type="submit">Subscribe</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
