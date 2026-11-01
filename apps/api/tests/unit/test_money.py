from utsavos.domain.money import ceil_div, format_inr, round_half_up


def test_indian_currency_grouping() -> None:
    assert format_inr(180_000_000) == "₹18,00,000"
    assert format_inr(8_080_000) == "₹80,800"
    assert format_inr(12_345_678_9) == "₹12,34,567.89"
    assert format_inr(-8_080_000) == "-₹80,800"
    assert format_inr(0) == "₹0"


def test_integer_rounding_helpers() -> None:
    assert round_half_up(5, 2) == 3
    assert round_half_up(4, 2) == 2
    assert ceil_div(10, 3) == 4
    assert ceil_div(-10, 3) == -3
