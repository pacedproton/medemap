-- Create the trust_in_media table
drop table public.demand_side_trust_in_media;
drop table public.basic_data;
drop table public.demand_side_media_use;
drop table public.democracy;
drop table public.legal_framework_equality;
drop table public.legal_framework_freedom;
drop table public.legal_framework_human_dignity;
DROP TABLE public.legal_framework_pluralism;
drop table public.legal_framework_rule_of_law;
DROP TABLE public.supply_side;

CREATE TABLE demand_side_trust_in_media (
    country VARCHAR(255),
    trust_media_general INTEGER,
    trust_information_provided_by_media INTEGER,
    news_media_and_trust_during_covid_19 INTEGER,
    trust_in_television INTEGER,
    trust_in_radio INTEGER,
    trust_in_written_press INTEGER,
    trust_in_internet INTEGER,
    trust_in_online_social_networks INTEGER,
    trust_in_public_tv_and_radio_stations INTEGER,
    trust_in_private_tv_and_radio_stations INTEGER,
    trust_in_written_press_incl_online_presence INTEGER,
    trust_in_other_online_news_platforms_incl_blogs_podcasts INTEGER,
    trust_in_youtube_or_other_video_platforms INTEGER,
    trust_in_people_followed_socialmedia_messaging_platforms INTEGER,
    trust_in_influencers_on_social_media_channels INTEGER
);

CREATE TABLE basic_data (
    no SERIAL PRIMARY KEY,
    country VARCHAR(255),
    EU_country_abbrivation CHAR(2),
    accession VARCHAR(255),
    population_2023 NUMERIC,
    area_km2 NUMERIC,
    largest_city VARCHAR(255),
    gdp_usd_m_2023 NUMERIC,
    gdp_ppp_percapita_2023_imf NUMERIC,
    currency VARCHAR(50),
    hdi_2023_udi NUMERIC,
    meps_2020 NUMERIC,
    meps_2024 NUMERIC,
    official_languages TEXT
);

CREATE TABLE demand_side_media_use (
    country VARCHAR(255) PRIMARY KEY,
    share_people_watching_tv_on_tvset INT,
    share_people_watching_tv_via_internet INT,
    share_people_listening_radio INT,
    share_people_reading_written_press INT,
    share_people_reading_news_internet INT,
    share_people_using_online_social_networks INT,
    people_following_influencers INT,
    high_confidence_in_identifying_disinformation INT,
    some_confidence_in_identifying_disinformation INT,
    importance_of_digital_technologies_personal_life_by_2030 INT,
    importance_digital_tech_interacting_creating_online_mat_by_2030 INT
);

CREATE TABLE democracy (
    country VARCHAR(255) PRIMARY KEY,
    electoral_democracy_index NUMERIC,
    liberal_democracy_index NUMERIC,
    participatory_democracy_index NUMERIC,
    deliberative_democracy_index NUMERIC,
    egalitarian_democracy_index NUMERIC,
    economist_democracy_index NUMERIC,
    economist_democracy_index_electoral_process_and_pluralism NUMERIC,
    economist_democracy_index_functioning_of_government NUMERIC,
    economist_democracy_index_political_participation NUMERIC,
    economist_democracy_index_political_culture NUMERIC,
    economist_democracy_index_civil_liberties NUMERIC,
    civic_participation NUMERIC,
    electoral_participation_last_election NUMERIC
);

CREATE TABLE legal_framework_equality (
    country VARCHAR(255) PRIMARY KEY,
    risk_fair_representation_of_minorities_in_media_content INT,
    risk_to_fair_representation_of_women_in_media_content INT,
    risk_non_discr_in_transp_alloc_state_subsidies_state_advert INT,
    risk_to_media_literacy INT,
    considerations_right_to_communicate_public_deliberation NUMERIC
);

CREATE TABLE legal_framework_freedom (
    country VARCHAR(255) PRIMARY KEY,
    freedom_of_expression_i NUMERIC,
    risk_to_protection_of_freedom_of_expression INT,
    media_freedom NUMERIC,
    world_press_freedom_index NUMERIC,
    foe_and_alternative_sources_of_information_index NUMERIC,
    protection_journalistic_privileges_legal NUMERIC,
    protection_journalistic_privileges_political_context NUMERIC,
    media_state_interference_print_broadcast_censorship_effort NUMERIC,
    risk_to_independence_of_media_from_state_interference INT,
    risk_to_transparency_of_media_ownership INT,
    protection_information_right NUMERIC,
    risk_right_of_information INT
);

CREATE TABLE legal_framework_human_dignity (
    country VARCHAR(255) PRIMARY KEY,
    protection_against_hate_speech NUMERIC,
    protection_physical_mental_digital_safety_journalists NUMERIC,
    protection_physical_mental_digi_safety_journalists_harassment NUMERIC
);

CREATE TABLE legal_framework_pluralism (
    country VARCHAR(255) PRIMARY KEY,
    media_market_plurality_economic_context NUMERIC,
    pluralism_of_views NUMERIC,
    risk_independence_editorial_content_from_commercial_influence INT,
    risk_to_protection_of_editorial_autonomy INT,
    risk_to_independence_of_public_service_media INT
);

CREATE TABLE legal_framework_rule_of_law (
    country VARCHAR(255) PRIMARY KEY,
    rule_of_law NUMERIC,
    risk_to_independence_media_authority_its_decision_transparency INT
);

CREATE TABLE supply_side(
    country VARCHAR(255) PRIMARY KEY,
    risk_to_transparency_of_media_ownership INT,
    risk_to_plurality_of_media_providers INT,
    risk_to_pluralit_in_digital_markets INT,
    risk_to_media_viability INT,
    risk_to_media_political_independence INT,
    risk_to_state_regulation_of_resources_and_support_media_sector INT,
    risk_to_independence_of_public_service_media INT,
    risk_to_local_regional_and_community_media INT,
    risk_representation_of_minorities_in_the_media INT,
    risk_to_gender_equality_in_the_media INT
);

COPY public.demand_side_trust_in_media
FROM '/var/lib/pgsql/import/demand_side_trust_in_media.csv'
CSV HEADER;

COPY public.basic_data
FROM '/var/lib/pgsql/import/basic_data.csv'
CSV HEADER;

COPY public.demand_side_media_use
FROM '/var/lib/pgsql/import/demand_side_media_use.csv'
CSV HEADER;

COPY public.democracy
FROM '/var/lib/pgsql/import/democracy.csv'
CSV HEADER;

COPY public.legal_framework_equality
FROM '/var/lib/pgsql/import/legal_framework_equality.csv'
CSV HEADER;

COPY public.legal_framework_freedom 
FROM '/var/lib/pgsql/import/legal_framework_freedom.csv'
CSV HEADER;

COPY public.legal_framework_human_dignity   
FROM '/var/lib/pgsql/import/legal_framework_human_dignity.csv'
CSV HEADER;

COPY public.legal_framework_pluralism
FROM '/var/lib/pgsql/import/legal_framework_pluralism.csv'
CSV HEADER;

COPY public.legal_framework_rule_of_law
FROM '/var/lib/pgsql/import/legal_framework_rule_of_law.csv'
CSV HEADER;

COPY public.supply_side
FROM '/var/lib/pgsql/import/supply_side.csv'
CSV HEADER;