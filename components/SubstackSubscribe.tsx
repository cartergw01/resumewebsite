"use client";

import Image from "next/image";
import { useState, useId } from "react";

const LOGO =
  "https://substackcdn.com/image/fetch/w_256,c_limit,f_auto,q_auto:best,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F7917be9a-8ed4-4519-ac5a-3145313d9419_1024x1024.png";

export function SubstackSubscribe() {
  const id = useId();
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "handoff">("idle");
  const subscribeUrl = `https://carterko.substack.com/subscribe?email=${encodeURIComponent(email.trim())}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    window.open(
      subscribeUrl,
      "_blank",
      "noopener,noreferrer",
    );
    setStatus("handoff");
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
          sizes="88px"
        />

        <div className="fa-body">
          <p className="fa-name">flying Arrows</p>
          <p className="fa-tagline">essays on tech, culture, and human nature.</p>

          <p className="fa-cta">Subscribe to keep up to date on new essays.</p>
          <form className="fa-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor={id}>Email address</label>
            <input
              id={id}
              className="fa-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setStatus("idle");
              }}
              required
              autoComplete="email"
              inputMode="email"
            />
            <button className="fa-btn" type="submit">Subscribe</button>
          </form>
          {status === "handoff" && (
            <p className="fa-thanks" role="status">
              <a href={subscribeUrl} data-native-navigation>Continue on Substack</a> to finish subscribing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
