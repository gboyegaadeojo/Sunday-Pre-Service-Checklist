-- Seed: IFC Pre-Service Checklist (requirements.md Section 6, US-14).
-- Generated from requirements.md v1.5. Section numbers come from sort_order, so they are not stored in names.

INSERT INTO task_lists (id, name, description, is_default) VALUES
  (1, 'IFC Pre-Service Checklist', 'Default checklist for regular Sunday services.', 1);


-- Presentation / Computer Graphics
INSERT INTO categories (id, list_id, name, sort_order) VALUES (1, 1, 'Presentation / Computer Graphics', 1);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (1, 1, 'Power & Initial System Check', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (1, 1, 'Verify all server rack devices are powered on, including the Mac and supporting hardware', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (2, 1, 'Wake up the Presentation Station Mac using the mouse or keyboard', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (2, 1, 'Launch Required Software', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (3, 2, 'Open ProPresenter', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (4, 2, 'Open the music software (Tidal, Spotify, or YouTube) — confirm it is copyright-free', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (5, 2, 'Close unnecessary apps and enable Do Not Disturb so no notifications appear on screen', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (3, 1, 'Prepare Worship Lyrics (Highest Priority)', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (6, 3, 'Check the media email (media@ifcwpg.com) for song lists', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (7, 3, 'Import all lyrics into ProPresenter', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (8, 3, 'Format lyrics: maximum two lines per slide, break slides based on how the song is sung', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (9, 3, 'Review each song a second time for accuracy, spelling, formatting, and pacing', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (10, 3, 'Confirm song order and arrangement (repeats, bridges, tags) with the worship leader', 5);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (4, 1, 'Prepare Scriptures & Sermon Notes', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (11, 4, 'Check the media email for Bible verses, sermon notes, and pastor requests', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (12, 4, 'Format and load all content into ProPresenter using correct themes and layouts', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (13, 4, 'Verify all macros function properly', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (14, 4, 'Confirm which Bible translation the pastor is preaching from', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (5, 1, 'Check Announcements', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (15, 5, 'Confirm whether announcements are live or video', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (16, 5, 'If video announcements are required, confirm we have the file; contact the announcement team if missing', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (17, 5, 'Import any requested images or videos from pastors and choir', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (18, 5, 'Ensure all images are horizontal', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (6, 1, 'Check Order of Service & WhatsApp Requests', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (19, 6, 'Review the Order of Service sent on the Media Team WhatsApp group', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (20, 6, 'Save it to the computer and understand the flow', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (21, 6, 'Review WhatsApp messages for special instructions or cues', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (22, 6, 'Share any changes to the order of service with the Director and Audio Engineer', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (7, 1, 'Copyright & Quality Check', 7);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (23, 7, 'Check the Copyrights folder in the media email', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (24, 7, 'Do NOT use videos unless confirmed copyright-safe, licensed, or approved', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (25, 7, 'If anything is unclear or missing, notify the media team immediately', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (26, 7, 'Confirm song credits and license number show on lyric slides if required', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (8, 1, 'Final Pre-Service Checks', 8);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (27, 8, 'Recheck all media emails to ensure nothing was missed', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (28, 8, 'Confirm readiness of lyrics, sermon notes, verses, videos, images, and announcements', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (29, 8, 'Verify the correct ProPresenter theme is applied', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (30, 8, 'Have a blank or logo slide ready to switch to if something goes wrong', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (9, 1, 'Service Start Procedures', 9);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (31, 9, '9:55 AM — Start livestream and coordinate with streaming personnel', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (32, 9, 'Begin looping introduction images', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (33, 9, 'Start non-copyright background music', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (34, 9, '10:04 AM — Play the 1-minute online welcome video', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (10, 1, 'During Service', 10);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (35, 10, 'Stay calm and focused', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (36, 10, 'Follow the service flow smoothly', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (37, 10, 'Keep ProPresenter cues ready and respond quickly', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (11, 1, 'Key Reminders', 11);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (38, 11, 'Audio MUST be tested', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (39, 11, 'Videos MUST be tested', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (40, 11, 'Images MUST be horizontal', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (41, 11, 'Lyrics MUST be clean and properly formatted', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (42, 11, 'Emails MUST be checked fully', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (43, 11, 'No copyrighted media unless explicitly approved', 6);

-- Audio Engineer
INSERT INTO categories (id, list_id, name, sort_order) VALUES (2, 1, 'Audio Engineer', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (12, 2, 'Power On', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (44, 12, 'Power on the console and stage boxes first, then amplifiers and powered speakers last', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (45, 12, 'Load the correct scene or show file for this service', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (13, 2, 'Microphones & Batteries', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (46, 13, 'Put fresh batteries in all wireless mics and bodypacks; keep spares at the desk', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (47, 13, 'Line-check every input on stage', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (48, 13, 'Test the pastor''s mic and confirm it is handed off before service', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (14, 2, 'Soundcheck & Monitors', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (49, 14, 'Soundcheck with the worship team and confirm monitor and in-ear mixes', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (50, 14, 'Check for feedback at service volume', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (15, 2, 'Verify Audio Functionality', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (51, 15, 'Test computer audio with the Presentation / Computer Graphics operator', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (52, 15, 'Ensure Tidal/Spotify playback is clear', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (53, 15, 'Check video playback audio levels from ProPresenter', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (16, 2, 'Livestream & Recording', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (54, 16, 'Confirm the livestream mix is reaching the stream at the right level', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (55, 16, 'Start the audio recording before service begins', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (17, 2, 'Communication', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (56, 17, 'Test headsets or intercom with the Director', 1);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (18, 2, 'During Service', 7);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (57, 18, 'Mute mics that are not in use', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (58, 18, 'Follow the order of service for mic and music cues', 2);

-- Camera Operators
INSERT INTO categories (id, list_id, name, sort_order) VALUES (3, 1, 'Camera Operators', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (19, 3, 'Camera Setup', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (59, 19, 'Power on cameras and check batteries or power supply', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (60, 19, 'Clean the lenses', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (61, 19, 'Level the tripod; check that pan and tilt move smoothly and lock', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (20, 3, 'Picture Check', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (62, 20, 'Set white balance and exposure so all cameras match (with the Director)', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (63, 20, 'Set focus and test the full zoom range', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (21, 3, 'Shots & Order of Service', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (64, 21, 'Review the order of service and your shot assignments', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (65, 21, 'Practice key shots: pulpit, worship leader, choir, and wide shot', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (22, 3, 'Communication', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (66, 22, 'Put on your headset and test intercom with the Director', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (67, 22, 'Confirm your tally light works', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (23, 3, 'Video & Visual Testing (with the Director)', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (68, 23, 'Play through all videos to confirm correct display, audio, and smooth playback', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (69, 23, 'Check all image slides for proper formatting and orientation', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (24, 3, 'During Service', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (70, 24, 'Hold a steady shot while live; reframe only after the Director cuts away', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (71, 24, 'Follow church guidelines on filming the congregation, especially children', 2);

-- Director (Switcher)
INSERT INTO categories (id, list_id, name, sort_order) VALUES (4, 1, 'Director (Switcher)', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (25, 4, 'Power & Systems', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (72, 25, 'Power on the switcher, multiview monitor, and streaming encoder', 1);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (26, 4, 'Inputs', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (73, 26, 'Confirm every camera appears on the multiview', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (74, 26, 'Confirm ProPresenter graphics and lower thirds reach the switcher and key correctly', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (75, 26, 'Confirm audio from the Audio Engineer is present and in sync with video', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (27, 4, 'Video & Visual Testing (with Camera Operators)', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (76, 27, 'Play through all videos to confirm correct display, audio, and smooth playback', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (77, 27, 'Check all image slides for proper formatting and orientation', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (78, 27, 'Match camera color and exposure with the Camera Operators', 3);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (28, 4, 'Livestream', 4);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (79, 28, 'Check the internet connection', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (80, 28, 'Confirm the stream title, thumbnail, and destination are correct', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (81, 28, 'Coordinate the 9:55 AM stream start with the Presentation / Computer Graphics operator', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (82, 28, 'Start a backup recording', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (29, 4, 'Team Briefing', 5);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (83, 29, 'Walk the Camera Operators through the order of service and key moments', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (84, 29, 'Confirm intercom with every operator', 2);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (30, 4, 'During Service', 6);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (85, 30, 'Call shots ahead of time ("Ready camera 2. Take 2.")', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (86, 30, 'Watch the stream output for audio or video problems', 2);

-- Miscellaneous
INSERT INTO categories (id, list_id, name, sort_order) VALUES (5, 1, 'Miscellaneous', 5);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (31, 5, 'Verify All Screens', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (87, 31, 'Test the altar-facing screens with a lyric slide or video', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (88, 31, 'Test the main sanctuary screens', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (89, 31, 'Confirm proper ProPresenter output on all displays', 3);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (90, 31, 'Check that the stage display (confidence monitor) shows lyrics and the clock', 4);
INSERT INTO sections (id, category_id, name, sort_order) VALUES (32, 5, 'Room & Equipment', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (91, 32, 'Set stage lighting and house lights to the service preset', 1);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (92, 32, 'Tidy or tape down cables in walkways', 2);
INSERT INTO tasks (id, section_id, text, sort_order) VALUES (93, 32, 'Restock spare batteries, adapters, and cables', 3);

