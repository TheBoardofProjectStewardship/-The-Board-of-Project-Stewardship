#!/usr/bin/env python3
"""Research city cells become PostalAddress localities without guessed cities."""
from __future__ import annotations

import unittest

import generate_site as gs


class SchemaAddressTests(unittest.TestCase):
    def test_woodway_stays_a_city(self) -> None:
        address, area = gs._schema_address("Woodway")
        self.assertEqual(address.get("addressLocality"), "Woodway")
        self.assertEqual(area, "")
        self.assertNotIn("Washington", address.values())

    def test_wood_inside_a_city_name_is_not_a_note(self) -> None:
        for raw, city in (("Woodinville, WA", "Woodinville"), ("Lynnwood, WA", "Lynnwood")):
            address, area = gs._schema_address(raw)
            self.assertEqual(address.get("addressLocality"), city, raw)
            self.assertEqual(area, "", raw)

    def test_county_is_a_service_area_not_a_city(self) -> None:
        for raw in ("Snohomish County", "Snohomish County, WA"):
            address, area = gs._schema_address(raw)
            self.assertNotIn("addressLocality", address, raw)
            self.assertIn("Snohomish County", area)
            self.assertNotEqual(address.get("addressLocality"), "Snohomish")

    def test_city_of_snohomish_stays(self) -> None:
        address, area = gs._schema_address("Snohomish, WA")
        self.assertEqual(address.get("addressLocality"), "Snohomish")
        self.assertEqual(area, "")

    def test_city_and_county_split(self) -> None:
        address, area = gs._schema_address("Everett / Snohomish County")
        self.assertEqual(address.get("addressLocality"), "Everett")
        self.assertIn("Snohomish County", area)

    def test_unknown_notes_are_not_guessed(self) -> None:
        for raw in ("Metro", "King & Snohomish wood framing", "Local"):
            address, area = gs._schema_address(raw)
            self.assertNotIn("addressLocality", address, raw)
            self.assertNotEqual(address.get("addressLocality"), "Washington")
            self.assertNotEqual(address.get("addressLocality"), "Snohomish")
            self.assertEqual(area, raw)

    def test_service_phrase_keeps_the_leading_city(self) -> None:
        address, area = gs._schema_address("Mill Creek area")
        self.assertEqual(address.get("addressLocality"), "Mill Creek")
        self.assertIn("area", area)
        address, area = gs._schema_address("Serves Edmonds")
        self.assertNotIn("addressLocality", address)
        self.assertIn("Edmonds", area)

    def test_itemlist_uses_the_split(self) -> None:
        payload = gs.itemlist_ld(
            "Example",
            "Example directory.",
            [
                {"rank": 1, "name": "Woodway Builders", "city": "Woodway", "website": "", "phone": ""},
                {"rank": 2, "name": "County Crew", "city": "Snohomish County", "website": "", "phone": ""},
            ],
            include_ppg=False,
        )
        items = [row["item"] for row in payload["itemListElement"]]
        self.assertEqual(items[0]["address"]["addressLocality"], "Woodway")
        self.assertNotIn("areaServed", items[0])
        self.assertNotIn("addressLocality", items[1]["address"])
        self.assertIn("Snohomish County", items[1]["areaServed"])


if __name__ == "__main__":
    unittest.main()
