"""Integer money helpers. No binary floating point is used for money."""

from __future__ import annotations


def ceil_div(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        raise ValueError("denominator must be positive")
    return -(-numerator // denominator)


def round_half_up(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        raise ValueError("denominator must be positive")
    return (numerator + denominator // 2) // denominator


def scale_percent(amount_minor: int, percent: int) -> int:
    """Exact integer scaling; `percent` is a whole percentage."""
    return round_half_up(amount_minor * percent, 100)


def _indian_group(rupees: int) -> str:
    digits = str(rupees)
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    parts: list[str] = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    parts.insert(0, head)
    return ",".join(parts) + "," + tail


def format_inr(minor: int) -> str:
    """Format paise as Indian rupees, e.g. 180000000 -> '₹18,00,000'."""
    sign = "-" if minor < 0 else ""
    rupees, paise = divmod(abs(minor), 100)
    body = _indian_group(rupees)
    if paise:
        return f"{sign}₹{body}.{paise:02d}"
    return f"{sign}₹{body}"
