/*
# Import members from previous Firestore database
Imports 37 members with loyalty data and 222 transactions.
Edoardo already has an auth account — his record is updated instead of inserted.
*/

CREATE OR REPLACE FUNCTION public.import_auth_user(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = auth, public
AS $$
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, deleted_at)
  VALUES (
    p_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    now(),
    now(),
    now(),
    NULL,
    '{}'::jsonb,
    jsonb_build_object('imported', true),
    false,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Skip Edoardo (21edoardo@gmail.com) — already has auth account
SELECT public.import_auth_user('87d16220-ac82-589e-838f-637c3a8552b9', 'aishationa@gmail.com');
SELECT public.import_auth_user('2e3cf68c-62d0-5e2b-8496-6323730a2da2', 'wawashin1234@gmail.com');
SELECT public.import_auth_user('b28d6037-9f76-5492-8919-f1d5423730aa', 'hendri.bhm@yahoo.com');
SELECT public.import_auth_user('c34ef431-8e20-52f9-850b-63a29e508be5', 'fatimah09@gmail.com');
SELECT public.import_auth_user('879600e1-7805-5780-857c-aadb700042c4', 'agnestanjung01@gmail.com');
SELECT public.import_auth_user('342db3c7-e38e-5189-88d1-6823fca927f9', 'fatiahsabrina6@gmail.com');
SELECT public.import_auth_user('97939d4b-588d-52c0-8f08-e46987cc28de', 'marbun.laura@gmail.com');
SELECT public.import_auth_user('ece379b9-ba49-561d-8c35-ea88d433d063', 'anggieafdila0906@gmail.com');
SELECT public.import_auth_user('f53208eb-63bf-55e5-852d-cb9fe1ea12a3', 'tati.astari@yahoo.co.id');
SELECT public.import_auth_user('289ce569-0f45-5c0d-8c95-87ef0cc99fbe', 'anatasya.trisna@gmail.com');
SELECT public.import_auth_user('095c87c9-fc34-59ea-860f-5144bb7dac5e', 'anwarevandwy@gmail.com');
SELECT public.import_auth_user('0e34af2f-f6e7-5470-8a0e-fe390b630d54', 'revayohanasinuhaji@gmail.com');
SELECT public.import_auth_user('c2aa9a65-8da2-5e67-84e1-e200e5eef460', 'capri_mint@yahoo.com');
SELECT public.import_auth_user('dc40a4e2-e457-554a-87b4-81dffc3c86c4', 'kurniawangarambax@gmail.com');
SELECT public.import_auth_user('38e93492-0966-5c2a-820e-c947b45fe5bf', 'steven.henk@gmail.com');
SELECT public.import_auth_user('632d7c96-9ce5-5818-8e34-89a950aa9f16', 'fenny_imported@13ecafe.com');
SELECT public.import_auth_user('d270942e-f152-5b75-8bfa-551c6eeb0aa5', 'tumpalsilaen00@gmail.com');
SELECT public.import_auth_user('99e4f93a-a52c-5cc1-82f4-553b3f237c4c', 'albopilosum2@gmail.com');
SELECT public.import_auth_user('83618e7d-cef2-5432-820d-4b43e66eee19', 'haikall170720@gmail.com');
SELECT public.import_auth_user('9fde9caa-3aaf-5dc9-8cb6-b5986b855a9f', 'afizaaulia0909@gmail.com');
SELECT public.import_auth_user('4cb9d741-72ff-5fc7-8116-9a4e62a05e42', 'nuzul311094@gmail.com');
SELECT public.import_auth_user('a280c056-4214-5408-87da-1ec5452e1f16', 'yeshuanoahv@gmail.com');
SELECT public.import_auth_user('094a14d9-26cb-5dae-88d1-9cffaecfa86d', 'azmiwira26@gmail.com');
SELECT public.import_auth_user('a24f29f7-0611-5396-8128-31e2d344e1f9', 'kartiniathira2804@gmail.com');
SELECT public.import_auth_user('7440f7bb-4452-5470-861c-23245ce580e2', 'helgadiohartanta@gmail.com');
SELECT public.import_auth_user('3defc487-394d-5989-814b-915343b424ca', 'lovedaisy130@gmail.com');
SELECT public.import_auth_user('fe622672-a211-5ec9-8d50-8c6baa242205', 'indahmagenta1@gmail.com');
SELECT public.import_auth_user('38750e75-d8ec-5029-85e8-b707917eddb7', 'dindakhairinaqila28@gmail.com');
SELECT public.import_auth_user('5a8f65bc-5caf-59e2-8421-66655ccfce0e', 'windi.tba88@gmail.com');
SELECT public.import_auth_user('7fa9323b-60e9-55c0-871f-9df1aea4f990', 'fredellacl@gmail.com');
SELECT public.import_auth_user('0e23f9e0-edcb-5aee-8d4c-07b42a1c4814', 'siwananthan43@hmai.com');
SELECT public.import_auth_user('37e2c360-c9b4-5cbc-8389-38a0e5b71e38', 'Pratamabudi057@gmail.com');
SELECT public.import_auth_user('c5428149-e544-5e4b-8915-735e79c239fe', 'viona_imported@13ecafe.com');
SELECT public.import_auth_user('1e9fca7d-f170-5e69-8a47-36848184ea48', 'farica_imported@13ecafe.com');
SELECT public.import_auth_user('797e8e48-74ce-5414-845b-d69b6492818a', 'bhm_imported@13ecafe.com');
SELECT public.import_auth_user('292598fa-3610-5e87-8dbf-454bb9239e05', 'timei_imported2@13ecafe.com');

DROP FUNCTION public.import_auth_user(uuid, text);

-- Update Edoardo's existing record with imported data
UPDATE members SET
  phone='08126477035', name='Edoardo', name_lower='edoardo',
  birthdate='2000-11-28', birth_month=11, birth_day=28,
  ktp='1271032811000001', tier='Silver', discount_rate=0, tax_rate=0.1,
  redeemable_points=16407, spending_since_upgrade=62640,
  monthly_since_upgrade=84000, yearly_since_upgrade=696000,
  upgrade_date='2025-07-08', welcomed=true,
  tier_restored_at='2026-01-17T09:07:46.000Z'
WHERE user_id='186f9131-6bb2-4c71-b7f2-979dad55dc0f';

-- Insert the other 36 members
INSERT INTO members (user_id,phone,email,name,name_lower,birthdate,birth_month,birth_day,ktp,tier,discount_rate,tax_rate,redeemable_points,spending_since_upgrade,monthly_since_upgrade,yearly_since_upgrade,upgrade_date,created_at,welcomed,tier_restored_at,last_room_upgrade,last_birthday_email_sent) VALUES
('87d16220-ac82-589e-838f-637c3a8552b9','081374525837','aishationa@gmail.com','Aisha Tiona','aisha tiona','1998-12-26',12,26,'1271036612980001','Silver',0,0.1,55510,0,338500,378500,'2025-07-06','2025-01-01T00:00:00Z',true,'2026-02-15T20:05:20.000Z',NULL,NULL),
('2e3cf68c-62d0-5e2b-8496-6323730a2da2','085373705500','wawashin1234@gmail.com','Ti Hua','ti hua','1976-07-13',7,13,'1271035307760002','Gold',0,0.1,314905,0,248000,248000,'2025-07-13','2025-01-01T00:00:00Z',true,'2026-01-17T09:07:46.000Z',NULL,NULL),
('b28d6037-9f76-5492-8919-f1d5423730aa','085372772111','hendri.bhm@yahoo.com','Hendri','hendri','1974-05-13',5,13,'1271031305740002','Gold',0,0.1,267739,0,257196,1340496,'2025-07-13','2025-01-01T00:00:00Z',true,'2026-02-15T20:05:20.000Z',NULL,NULL),
('c34ef431-8e20-52f9-850b-63a29e508be5','082161678246','fatimah09@gmail.com','Fatimah','fatimah','1995-01-09',1,9,'1271024901950004','Bronze',0,0.1,0,0,48500,95900,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('879600e1-7805-5780-857c-aadb700042c4','081275184984','agnestanjung01@gmail.com','Agnes Tanjung','agnes tanjung','1995-10-29',10,29,'1408046910950005','Bronze',0,0.1,0,0,66200,66200,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('342db3c7-e38e-5189-88d1-6823fca927f9','081990145015','fatiahsabrina6@gmail.com','Fatiah Sabrina','fatiah sabrina','2003-09-15',9,15,'1271215509030001','Bronze',0,0.1,0,0,0,0,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('97939d4b-588d-52c0-8f08-e46987cc28de','085370361602','marbun.laura@gmail.com','Laura Noviani','laura noviani','1998-10-31',10,31,'1271037110890001','Bronze',0,0.1,0,0,0,0,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('ece379b9-ba49-561d-8c35-ea88d433d063','081260123728','anggieafdila0906@gmail.com','Anggie Afdila','anggie afdila','2004-06-09',6,9,'1271064906040003','Bronze',0,0.1,0,0,6900,20700,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('f53208eb-63bf-55e5-852d-cb9fe1ea12a3','085275888568','tati.astari@yahoo.co.id','Tati Astari','tati astari','1980-09-30',9,30,'1207247009800007','Silver',0,0.1,28675,0,19000,19000,NULL,'2025-01-01T00:00:00Z',true,'2026-01-17T09:07:46.000Z',NULL,NULL),
('289ce569-0f45-5c0d-8c95-87ef0cc99fbe','081360048432','anatasya.trisna@gmail.com','Trisna Anatasya','trisna anatasya','1995-12-07',12,7,'1106074712940004','Bronze',0,0.1,0,0,104000,154000,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('095c87c9-fc34-59ea-860f-5144bb7dac5e','089656871000','anwarevandwy@gmail.com','Evan Dwy Anwar','evan dwy anwar','2004-08-20',8,20,'1271122008040001','Bronze',0,0.1,0,0,43500,43500,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('0e34af2f-f6e7-5470-8a0e-fe390b630d54','085359238244','revayohanasinuhaji@gmail.com','Reva cantik','reva cantik','1997-12-05',12,5,'1206024512970001','Bronze',0,0.1,0,0,0,23700,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('c2aa9a65-8da2-5e67-84e1-e200e5eef460','081396116201','capri_mint@yahoo.com','Amy','amy','1986-01-03',1,3,'1271194301860002','Bronze',0,0.1,0,0,116000,273300,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('dc40a4e2-e457-554a-87b4-81dffc3c86c4','082120096644','kurniawangarambax@gmail.com','Kurniawan Garamba','kurniawan garamba','1994-03-25',3,25,'1214052503940001','Bronze',0,0.1,0,0,21700,172200,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('38e93492-0966-5c2a-820e-c947b45fe5bf','01973117576','steven.henk@gmail.com','Steven','steven','1992-02-15',2,15,'1271051502920001','Silver',0,0.1,34645,0,102000,102000,'2025-08-03','2025-01-01T00:00:00Z',true,'2026-01-29T09:08:52.000Z',NULL,NULL),
('632d7c96-9ce5-5818-8e34-89a950aa9f16','081268858677','','Fenny','fenny','1970-12-07',12,7,'1271110712700002','Bronze',0,0.1,0,0,130400,130400,NULL,'2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('d270942e-f152-5b75-8bfa-551c6eeb0aa5','082160999016','tumpalsilaen00@gmail.com','Tumpal Afrianto','tumpal afrianto','1987-04-09',4,9,'1216060904870002','Bronze',0,0.1,66250,0,252000,252000,'2025-08-05','2025-01-01T00:00:00Z',true,NULL,NULL,NULL),
('99e4f93a-a52c-5cc1-82f4-553b3f237c4c','1','albopilosum2@gmail.com','aa','aa','2000-11-28',11,28,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2025-09-23T06:53:48.000Z',true,NULL,NULL,NULL),
('83618e7d-cef2-5432-820d-4b43e66eee19','081268656959','haikall170720@gmail.com','Haikal','haikal','2003-05-08',5,8,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2025-10-03T08:34:47.000Z',true,NULL,NULL,NULL),
('9fde9caa-3aaf-5dc9-8cb6-b5986b855a9f','081268459461','afizaaulia0909@gmail.com','bagus Maulana','bagus maulana','2025-10-14',10,14,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2025-10-14T05:15:51.000Z',true,NULL,NULL,NULL),
('4cb9d741-72ff-5fc7-8116-9a4e62a05e42','082366468334','nuzul311094@gmail.com','Indah pratiwi','indah pratiwi','2004-07-07',7,7,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2025-10-15T11:32:53.000Z',true,NULL,NULL,NULL),
('a280c056-4214-5408-87da-1ec5452e1f16','089615178608','yeshuanoahv@gmail.com','Yeshua Noah','yeshua noah','2002-11-02',11,2,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2025-10-17T06:03:27.000Z',true,NULL,NULL,NULL),
('094a14d9-26cb-5dae-88d1-9cffaecfa86d','08566662508','azmiwira26@gmail.com','Azmi','azmi','2025-10-26',10,26,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2025-10-31T08:05:10.000Z',true,NULL,NULL,NULL),
('a24f29f7-0611-5396-8128-31e2d344e1f9','085833197124','kartiniathira2804@gmail.com','Kartini','kartini','2005-01-04',1,4,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2025-11-08T12:40:49.000Z',true,NULL,NULL,NULL),
('7440f7bb-4452-5470-861c-23245ce580e2','085831166130','helgadiohartanta@gmail.com','HELGA DIO HARTANTA TARIGAN','helga dio hartanta tarigan','2006-08-15',8,15,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2026-04-09T22:23:50.000Z',true,NULL,NULL,NULL),
('3defc487-394d-5989-814b-915343b424ca','081269641923','lovedaisy130@gmail.com','Sinta','sinta','2026-05-06',5,6,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2026-05-01T11:51:15.000Z',true,NULL,NULL,NULL),
('fe622672-a211-5ec9-8d50-8c6baa242205','083179446921','indahmagenta1@gmail.com','indah','indah','1995-03-05',3,5,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2026-05-03T01:57:26.000Z',true,NULL,NULL,NULL),
('38750e75-d8ec-5029-85e8-b707917eddb7','0895613210799','dindakhairinaqila28@gmail.com','ririn','ririn','2001-02-01',2,1,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2026-06-04T11:25:44.000Z',true,NULL,NULL,NULL),
('5a8f65bc-5caf-59e2-8421-66655ccfce0e','081360968089','windi.tba88@gmail.com','Windi Asdini Rindu Pasaribu','windi asdini rindu pasaribu','1998-09-05',9,5,NULL,'Classic',0.1,0.1,0,0,0,0,NULL,'2026-07-26T11:26:17.000Z',true,NULL,NULL,NULL),
('7fa9323b-60e9-55c0-871f-9df1aea4f990','082213224264','fredellacl@gmail.com','Timei','timei','1975-06-20',6,20,'1271026006750002','Bronze',0,0.1,0,0,255500,891000,NULL,'2025-08-28T14:53:49.000Z',true,NULL,NULL,NULL),
('0e23f9e0-edcb-5aee-8d4c-07b42a1c4814','085270526031','siwananthan43@hmai.com','Siwa','siwa','1991-01-31',1,31,'1271023101910003','Silver',0,0.1,0,0,0,0,NULL,'2026-01-31T08:18:15.000Z',true,NULL,NULL,'2026-01-31T08:18:21.000Z'),
('37e2c360-c9b4-5cbc-8389-38a0e5b71e38','081375247651','Pratamabudi057@gmail.com','Budi pratama putra','budi pratama putra','1986-11-06',11,6,'1271030611860005','Bronze',0,0.1,0,0,0,0,NULL,'2025-09-11T07:43:03.000Z',true,NULL,NULL,'2025-11-06T10:16:22.000Z'),
('c5428149-e544-5e4b-8915-735e79c239fe','088266272830','','Viona','viona','2002-05-15',5,15,NULL,'Bronze',0,0.1,0,0,24000,24000,NULL,'2025-12-24T06:02:30.000Z',true,NULL,NULL,'2026-05-15T08:42:16.000Z'),
('1e9fca7d-f170-5e69-8a47-36848184ea48','087787218713','','Farica','farica','1992-08-24',8,24,'1271196408920003','Bronze',0,0.1,0,0,438500,438500,NULL,'2025-09-06T12:32:25.000Z',true,NULL,NULL,'2026-08-24T02:36:30.000Z'),
('797e8e48-74ce-5414-845b-d69b6492818a','bentenghondamotor','','BHM','bhm',NULL,NULL,NULL,NULL,'Bronze',0,0.1,0,0,0,0,NULL,'2025-08-26T10:25:28.000Z',true,NULL,NULL,NULL),
('292598fa-3610-5e87-8dbf-454bb9239e05','082213224264','fredellacl@gmail.com','Timei','timei','1975-06-20',6,20,'1271026006750002','Bronze',0,0.1,0,0,0,0,NULL,'2025-08-28T14:53:47.000Z',true,NULL,NULL,NULL)
ON CONFLICT (user_id) DO NOTHING;
