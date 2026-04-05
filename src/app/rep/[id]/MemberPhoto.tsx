"use client";

import { useState } from "react";

export default function MemberPhoto({
  memberId,
  firstName,
  lastName,
  isR,
}: {
  memberId: string;
  firstName: string;
  lastName: string;
  isR: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const photoUrl = `https://leg.wa.gov/memberthumbnail/${memberId}.jpg`;

  const ringClass = isR ? "ring-red-100" : "ring-blue-100";
  const gradientClass = isR
    ? "bg-gradient-to-br from-red-500 to-red-700"
    : "bg-gradient-to-br from-blue-500 to-blue-700";

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        width={80}
        height={80}
        onError={() => setFailed(true)}
        className={`w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-lg ring-4 ${ringClass}`}
      />
    );
  }

  return (
    <div
      className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0 shadow-lg ring-4 ${gradientClass} ${ringClass}`}
    >
      {firstName[0]}{lastName[0]}
    </div>
  );
}
